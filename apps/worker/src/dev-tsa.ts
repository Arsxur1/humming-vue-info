import { execFile as execFileCb } from 'node:child_process';
import { createServer, type Server } from 'node:http';
import { mkdir, writeFile, readFile, rm, mkdtemp } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { promisify } from 'node:util';

const execFile = promisify(execFileCb);

/**
 * Встроенный dev-TSA (RFC 3161 поверх openssl ts). Нужен потому, что
 * c2pa-подпись требует метку времени, а в dev/CI внешний TSA недоступен.
 * В production задаётся C2PA_TSA_URL реального сервиса — этот код не трогается.
 */

const TSA_CNF = `oid_section = new_oids
[ new_oids ]
tsa_policy1 = 1.2.3.4.1

[ tsa ]
default_tsa = tsa_config1

[ tsa_config1 ]
serial = SERIAL_PATH
crypto_device = builtin
signer_cert = CERT_PATH
signer_key = KEY_PATH
signer_digest = sha256
certs = CERT_PATH
default_policy = tsa_policy1
digests = sha256, sha384, sha512
accuracy = secs:1
clock_precision_digits = 0
ordering = yes
tsa_name = yes
ess_cert_id_chain = no

[ req ]
distinguished_name = req_dn
x509_extensions = tsa_ext
prompt = no
[ req_dn ]
CN = AvatarStudio Dev TSA
[ tsa_ext ]
keyUsage = critical,digitalSignature
extendedKeyUsage = critical,timeStamping
`;

export interface DevTsa {
  url: string;
  close(): Promise<void>;
}

export async function startDevTsa(baseDir?: string): Promise<DevTsa> {
  const dir = baseDir ?? path.join(tmpdir(), 'avatarstudio-dev-tsa');
  await mkdir(dir, { recursive: true });
  const cnf = path.join(dir, 'tsa.cnf');
  const key = path.join(dir, 'tsa.key');
  const crt = path.join(dir, 'tsa.crt');
  const serial = path.join(dir, 'serial');

  if (!existsSync(crt)) {
    await writeFile(
      cnf,
      TSA_CNF.replaceAll('SERIAL_PATH', serial).replaceAll('CERT_PATH', crt).replaceAll('KEY_PATH', key),
    );
    await writeFile(serial, '01\n');
    await execFile('openssl', [
      'req', '-x509',
      '-newkey', 'ec', '-pkeyopt', 'ec_paramgen_curve:P-256',
      '-keyout', key, '-out', crt, '-nodes', '-days', '365', '-config', cnf,
    ]);
  }

  const server: Server = createServer((req, res) => {
    const chunks: Buffer[] = [];
    req.on('data', (c: Buffer) => chunks.push(c));
    req.on('end', () => {
      void (async () => {
        const work = await mkdtemp(path.join(dir, 'req-'));
        try {
          const tsq = path.join(work, 'query.tsq');
          const tsr = path.join(work, 'reply.tsr');
          await writeFile(tsq, Buffer.concat(chunks));
          await execFile('openssl', ['ts', '-reply', '-queryfile', tsq, '-config', cnf, '-out', tsr]);
          const reply = await readFile(tsr);
          res.writeHead(200, { 'Content-Type': 'application/timestamp-reply' });
          res.end(reply);
        } catch (err) {
          console.error('[dev-tsa] ошибка ответа:', err);
          res.writeHead(500);
          res.end();
        } finally {
          await rm(work, { recursive: true, force: true });
        }
      })();
    });
  });

  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const address = server.address() as { port: number };
  return {
    url: `http://127.0.0.1:${address.port}`,
    close: () => new Promise((resolve) => server.close(() => resolve())),
  };
}

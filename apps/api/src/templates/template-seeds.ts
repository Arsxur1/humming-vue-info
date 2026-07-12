/**
 * Стартовые стоковые шаблоны (Этап 9). Это сиды-минимум по доменам D2;
 * полноценная библиотека ≥150 (FR-6.1) — контент-продакшн, не разработка
 * (ТЗ 8.5; Критика ТЗ 1.8: на запуск 40–50 от дизайнера).
 */

export interface TemplateSeedScene {
  script: string;
  background: Record<string, unknown>;
  title?: string;
}

export interface TemplateSeed {
  name: string;
  category: string;
  description: string;
  aspectRatio: '16:9' | '9:16' | '1:1';
  scenes: TemplateSeedScene[];
}

const bg = (color: string) => ({ type: 'color', color });

export const TEMPLATE_SEEDS: TemplateSeed[] = [
  {
    name: 'Видеоурок: введение в тему',
    category: 'learning',
    description: 'Классическая структура урока: цель → материал → закрепление.',
    aspectRatio: '16:9',
    scenes: [
      {
        title: '{{course_name}}',
        script:
          'Здравствуйте! [pause:0.4s] Это урок курса «{{course_name}}». Сегодня вы узнаете [emphasis]{{lesson_goal}}[/emphasis]. [gesture:open-hands]',
        background: bg('#1a2634'),
      },
      {
        script:
          'Разберём главное. [pause:0.4s] {{key_point}}. [look:slide] Обратите внимание на детали на экране.',
        background: bg('#152030'),
      },
      {
        script:
          'Подведём итог. [pause:0.4s] Вы узнали {{lesson_goal}}. [gesture:nod] В следующем уроке — продолжение. До встречи!',
        background: bg('#1a2634'),
      },
    ],
  },
  {
    name: 'Микрообучение: один навык',
    category: 'learning',
    description: 'Короткий формат: один навык за 60 секунд.',
    aspectRatio: '16:9',
    scenes: [
      {
        script:
          'Одна минута — один навык. [pause:0.3s] Сегодня: [emphasis]{{skill}}[/emphasis]. [gesture:count-1] Шаг первый: {{step_one}}. [gesture:count-2] Шаг второй: {{step_two}}. Попробуйте прямо сейчас!',
        background: bg('#12343b'),
      },
    ],
  },
  {
    name: 'Комплаенс-инструктаж',
    category: 'compliance',
    description: 'Обязательный инструктаж с фиксацией ключевых правил.',
    aspectRatio: '16:9',
    scenes: [
      {
        script:
          '[emotion:serious]Здравствуйте. Это обязательный инструктаж по теме «{{policy_name}}» для сотрудников {{company}}.[/emotion]',
        background: bg('#26201a'),
      },
      {
        script:
          '[emotion:serious]Главное правило: [emphasis]{{main_rule}}[/emphasis]. [pause:0.6s] Нарушение ведёт к последствиям, описанным в политике.[/emotion] [look:slide]',
        background: bg('#211c17'),
      },
      {
        script:
          'Спасибо за внимание. [pause:0.4s] Подтвердите прохождение инструктажа в вашем личном кабинете. [gesture:nod]',
        background: bg('#26201a'),
      },
    ],
  },
  {
    name: 'ИБ: осторожно, фишинг',
    category: 'compliance',
    description: 'Инструктаж по информационной безопасности.',
    aspectRatio: '16:9',
    scenes: [
      {
        script:
          '[emotion:serious]Внимание! Участились фишинговые письма.[/emotion] [pause:0.4s] Проверяйте отправителя, [emphasis]не открывайте вложения[/emphasis] от незнакомцев и сообщайте в {{security_contact}}. [gesture:point-right]',
        background: bg('#2b1a1a'),
      },
    ],
  },
  {
    name: 'Онбординг: первый день',
    category: 'onboarding',
    description: 'Приветствие нового сотрудника.',
    aspectRatio: '16:9',
    scenes: [
      {
        script:
          '[emotion:friendly]Привет, {{first_name}}! [gesture:open-hands] Добро пожаловать в {{company}}! Мы рады, что ты с нами.[/emotion]',
        background: bg('#1c2a3a'),
      },
      {
        script:
          'Твой первый день: [gesture:count-1] знакомство с командой, [gesture:count-2] настройка рабочих инструментов, [gesture:count-3] встреча с руководителем {{manager_name}}.',
        background: bg('#16222e'),
      },
      {
        script: '[emotion:friendly]Хорошего первого дня! [pause:0.3s] Мы на связи. [gesture:nod][/emotion]',
        background: bg('#1c2a3a'),
      },
    ],
  },
  {
    name: 'Онбординг: знакомство с командой',
    category: 'onboarding',
    description: 'Представление команды и ролей.',
    aspectRatio: '16:9',
    scenes: [
      {
        script:
          'Знакомься — команда {{team_name}}. [pause:0.4s] Мы отвечаем за {{team_mission}}. [look:slide] На экране — кто есть кто.',
        background: bg('#1f2937'),
      },
    ],
  },
  {
    name: 'Персональное видео для лида',
    category: 'sales',
    description: 'Личное обращение к потенциальному клиенту (для bulk-персонализации).',
    aspectRatio: '16:9',
    scenes: [
      {
        script:
          '[emotion:friendly]Здравствуйте, {{first_name}}! [gesture:open-hands] Меня зовут {{sender_name}}, и я записал это видео специально для {{company}}.[/emotion]',
        background: bg('#1a2436'),
      },
      {
        script:
          '[emotion:confident]{{product}} поможет вам [emphasis]{{value_prop}}[/emphasis]. [pause:0.5s] Предлагаю созвониться на этой неделе. [gesture:nod][/emotion]',
        background: bg('#152438'),
      },
    ],
  },
  {
    name: 'Демо продукта',
    category: 'product',
    description: 'Структура продуктового демо: проблема → решение → призыв.',
    aspectRatio: '16:9',
    scenes: [
      {
        script:
          'Знакомая ситуация: {{pain_point}}? [pause:0.5s] Есть решение. [gesture:point-right]',
        background: bg('#101d2c'),
      },
      {
        script:
          '[emotion:confident]Встречайте {{product}}. [pause:0.4s] Он [emphasis]{{key_benefit}}[/emphasis]. [look:slide] Посмотрите, как это работает.[/emotion]',
        background: bg('#0d1826'),
      },
      {
        script: 'Попробуйте бесплатно на {{website}}. [pause:0.3s] До встречи в продукте! [gesture:nod]',
        background: bg('#101d2c'),
      },
    ],
  },
  {
    name: 'Анонс: скоро релиз',
    category: 'marketing',
    description: 'Короткий тизер релиза или события.',
    aspectRatio: '16:9',
    scenes: [
      {
        script:
          '[emotion:energetic]Большая новость! [pause:0.3s] {{announcement}} — уже {{date}}. [emphasis]Не пропустите.[/emphasis][/emotion] [gesture:open-hands]',
        background: bg('#241a33'),
      },
    ],
  },
  {
    name: 'Вертикальный ролик: 3 совета',
    category: 'social',
    description: 'Формат 9:16 для соцсетей: три быстрых совета.',
    aspectRatio: '9:16',
    scenes: [
      {
        script:
          '[emotion:energetic]Три совета про {{topic}}! [gesture:count-1] Первый: {{tip_one}}. [gesture:count-2] Второй: {{tip_two}}. [gesture:count-3] Третий: {{tip_three}}. Подписывайтесь![/emotion]',
        background: bg('#331a26'),
      },
    ],
  },
  {
    name: 'HR: приглашение на интервью',
    category: 'hr',
    description: 'Персональное приглашение кандидата.',
    aspectRatio: '16:9',
    scenes: [
      {
        script:
          '[emotion:friendly]Здравствуйте, {{first_name}}! Команда {{company}} рада пригласить вас на интервью на позицию [emphasis]{{position}}[/emphasis]. [pause:0.4s] Детали — в письме. До встречи! [gesture:nod][/emotion]',
        background: bg('#1c3028'),
      },
    ],
  },
  {
    name: 'Дайджест недели',
    category: 'news',
    description: 'Регулярный новостной формат для внутренних коммуникаций.',
    aspectRatio: '16:9',
    scenes: [
      {
        script:
          'Дайджест недели в {{company}}. [pause:0.4s] [gesture:count-1] {{news_one}}. [gesture:count-2] {{news_two}}. [pause:0.3s] Подробности — на портале. [look:camera] Хорошей недели!',
        background: bg('#20262e'),
      },
    ],
  },
];

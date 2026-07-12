import { useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { useAuth } from '../store/auth.js';
import { useEditor } from '../store/editor.js';
import { TopBar } from '../components/TopBar.js';
import { ScenesPanel } from '../components/ScenesPanel.js';
import { CanvasStage } from '../components/CanvasStage.js';
import { ScriptPanel } from '../components/ScriptPanel.js';
import { InspectorPanel } from '../components/InspectorPanel.js';
import { RenderDialog } from '../components/RenderDialog.js';

export function EditorPage() {
  const { projectId } = useParams<{ projectId: string }>();
  const { workspace } = useAuth();
  const { project, load, renderJob } = useEditor();

  useEffect(() => {
    if (workspace && projectId) void load(workspace.id, projectId);
  }, [workspace, projectId, load]);

  if (!project) return <p style={{ padding: 32 }}>Загрузка проекта…</p>;

  return (
    <div className="editor-layout">
      <TopBar />
      <ScenesPanel />
      <div className="canvas-area">
        <div className="canvas-host">
          <CanvasStage />
        </div>
        <ScriptPanel />
      </div>
      <InspectorPanel />
      {renderJob && <RenderDialog />}
    </div>
  );
}

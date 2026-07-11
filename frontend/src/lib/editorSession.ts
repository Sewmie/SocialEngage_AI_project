export type EditorHandoff = {
    imageBlobUrl: string;
    filterName: string;
    aspectLabel: string;
  };
  
  let session: EditorHandoff | null = null;
  
  export function saveEditorHandoff(data: EditorHandoff) {
    session = data;
  }
  
  export function loadEditorHandoff(): EditorHandoff | null {
    return session;
  }
  
  export function clearEditorHandoff() {
    session = null;
  }
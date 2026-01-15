import { useEffect, useRef } from "react";
import EditorJS from "./components/EditorJS/src/codex";
import CustomBold from "./components/CustomBold";
import CustomItalic from "./components/CustomItalic";
import CustomLinkWithRangy from "./components/CustomLinkWithRangy";
import "./components/EditorJS/src/styles/main.css";
import "./App.css";

function App() {
  const editorRef = useRef<EditorJS | null>(null);

  useEffect(() => {
    if (!editorRef.current) {
      const editor = new EditorJS({
        holder: "editorjs",
        placeholder: "Start writing your story...",
        tools: {
          bold: CustomBold,
          italic: CustomItalic,
          link: CustomLinkWithRangy,
        },
      });

      editorRef.current = editor;
    }

    return () => {
      if (
        editorRef.current &&
        typeof editorRef.current.destroy === "function"
      ) {
        editorRef.current.destroy();
        editorRef.current = null;
      }
    };
  }, []);

  return (
    <div style={{ maxWidth: "800px", margin: "50px auto" }}>
      <h1>Editor.js + React + TypeScript</h1>
      <div id="editorjs"></div>
    </div>
  );
}

export default App;

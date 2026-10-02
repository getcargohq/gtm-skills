import {
  FrameShapeUtil,
  serializeTldrawJsonBlob,
  Tldraw,
  type Editor,
  type TLComponents,
} from "tldraw";
import { buildMap, clearMap, hasMap } from "./buildMap";
import { BRAND_FONTS, cargoTheme } from "./theme";

const shapeUtils = [FrameShapeUtil.configure({ showColors: true })];

const buttonStyle = {
  font: "600 13px Inter, sans-serif",
  padding: "7px 12px",
  borderRadius: 8,
  border: "1px solid #2E2E2E",
  background: "#171717",
  color: "#FAFAFA",
  cursor: "pointer",
};

const components: TLComponents = {
  SharePanel: function MapButtons() {
    const editor = () => (window as any).editor as Editor;
    return (
      <div
        style={{ pointerEvents: "all", padding: 8, display: "flex", gap: 6 }}
      >
        <button
          title="Deletes every generated shape (yours stay) and redraws the map from src/cookbooks.json and src/paths.json"
          onClick={() => rebuild(editor())}
          style={buttonStyle}
        >
          Rebuild
        </button>
        <button
          title="Saves the canvas as a .tldr file you can drop into tldraw.com"
          onClick={() => download(editor())}
          style={buttonStyle}
        >
          Download .tldr
        </button>
      </div>
    );
  },
};

async function download(editor: Editor) {
  const a = document.createElement("a");
  a.href = URL.createObjectURL(await serializeTldrawJsonBlob(editor));
  a.download = `gtm-cookbooks-${new Date().toISOString().slice(0, 10)}.tldr`;
  a.click();
  URL.revokeObjectURL(a.href);
}

async function rebuild(editor: Editor) {
  // Card heights are measured from the rendered text, so the brand fonts
  // have to be in before the first shape is laid out.
  await Promise.all(BRAND_FONTS.map((f) => document.fonts.load(f)));
  const logo = await logoDataUrl();
  editor.run(() => {
    clearMap(editor);
    buildMap(editor, logo);
  });
  editor.zoomToFit({ animation: { duration: 300 } });
}

async function logoDataUrl() {
  const svg = await (await fetch("/cargo-logo.svg")).text();
  return `data:image/svg+xml;base64,${btoa(svg)}`;
}

export default function App() {
  return (
    <div style={{ position: "fixed", inset: 0 }}>
      <Tldraw
        persistenceKey="gtm-cookbooks-map"
        colorScheme="dark"
        themes={{ default: cargoTheme }}
        shapeUtils={shapeUtils}
        components={components}
        onMount={(editor) => {
          (window as any).editor = editor;
          if (!hasMap(editor)) rebuild(editor);
        }}
      />
    </div>
  );
}

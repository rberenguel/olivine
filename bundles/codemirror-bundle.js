import {
  EditorState,
  EditorSelection,
  StateField,
  RangeSetBuilder,
} from "@codemirror/state";
import {
  EditorView,
  keymap,
  Decoration,
  WidgetType,
  ViewPlugin,
} from "@codemirror/view";
import { defaultKeymap } from "@codemirror/commands";
import { markdown, markdownLanguage } from "@codemirror/lang-markdown";
import { autocompletion, completionKeymap } from "@codemirror/autocomplete";
import { oneDark } from "@codemirror/theme-one-dark";
import MiniSearch from "minisearch";
import { syntaxTree } from "@codemirror/language";
import { GFM } from "@lezer/markdown"; // <-- The correct import

export {
  RangeSetBuilder,
  StateField,
  EditorSelection,
  EditorState,
  EditorView,
  WidgetType,
  ViewPlugin,
  keymap,
  defaultKeymap,
  markdown,
  oneDark,
  MiniSearch,
  // For the live preview plugin
  Decoration,
  syntaxTree,
  markdownLanguage,
  autocompletion,
  completionKeymap,
  GFM,
};

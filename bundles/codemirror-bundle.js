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
import { Transaction } from "@codemirror/state";
import { history, defaultKeymap, historyKeymap } from "@codemirror/commands";
import { markdown, markdownLanguage } from "@codemirror/lang-markdown";
import { languages } from "@codemirror/language-data";
import { autocompletion, completionKeymap } from "@codemirror/autocomplete";
import { oneDark } from "@codemirror/theme-one-dark";
import MiniSearch from "minisearch";
import { syntaxTree } from "@codemirror/language";
import { GFM } from "@lezer/markdown"; // <-- The correct import
import { marked } from "marked";

export {
  Transaction,
  RangeSetBuilder,
  StateField,
  EditorSelection,
  EditorState,
  EditorView,
  WidgetType,
  ViewPlugin,
  keymap,
  history,
  defaultKeymap,
  historyKeymap,
  languages,
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
  marked,
};

// Codepoints conferidos em 2026-08-26 contra o arquivo oficial
// `MaterialSymbolsOutlined[FILL,GRAD,opsz,wght].codepoints` do repositorio
// google/material-design-icons (branch master, baixado em 2026-08-26).
// 5 valores do handoff original estavam errados (vinham da fonte legada
// "Material Icons", nao da "Material Symbols") e foram corrigidos:
// search, forum, person, cloud, edit. Ver task-3-report.md para o detalhe.
export const codepoints = {
  psychology: "\uea4a",
  description: "\ue873",
  hub: "\ue9f4",
  search: "\uef7a",
  forum: "\ue8af",
  settings: "\ue8b8",
  person: "\uf0d3",
  logout: "\ue9ba",
  cloud: "\uf15c",
  sync: "\ue627",
  info: "\ue88e",
  add: "\ue145",
  edit: "\uf097",
  close: "\ue5cd",
  arrow_back: "\ue5c4",
  arrow_upward: "\ue5d8",
  attach_file: "\ue226",
  center_focus_strong: "\ue3b4",
  sell: "\uf05b",
  open_in_full: "\uf1ce",
  folder: "\ue2c7",
  folder_open: "\ue2c8",
  more_horiz: "\ue5d3",
} as const;

export type NomeDeIcone = keyof typeof codepoints;

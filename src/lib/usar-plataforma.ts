"use client";
import { useSyncExternalStore } from "react";

const assinar = () => () => {};
const noMac = () => /Mac|iPhone|iPad/.test(navigator.platform);
/** A renderização inicial coincide com o servidor; depois usa a plataforma do navegador. */
export function useNoMac(): boolean { return useSyncExternalStore(assinar, noMac, () => false); }

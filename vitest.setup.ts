/**
 * Roda antes de cada arquivo de teste. Hoje só liga os matchers extras do
 * jest-dom (`toBeInTheDocument`, etc.) usados pelos testes de componente.
 */
import "@testing-library/jest-dom/vitest";

/** Recusa esperada que pode ser mostrada ao modelo e à pessoa. */
export class ErroDeFerramenta extends Error {
  constructor(mensagem: string) {
    super(mensagem);
    this.name = "ErroDeFerramenta";
  }
}

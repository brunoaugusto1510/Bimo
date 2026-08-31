import { useEffect, useRef, useState, type ComponentRef, type ReactNode } from "react";
import { Keyboard, View, type StyleProp, type ViewStyle } from "react-native";

// Quanto o teclado invade a area. O evento do Android traz duas medidas, e cada
// uma falha de um jeito:
//
// - `topoDoTeclado` (`endCoordinates.screenY`) sai de
//   `getWindowVisibleDisplayFrame` (`ReactRootView.java:951`), que enxerga so a
//   janela principal do IME. Faixa de sugestoes — as palavras aprendidas do
//   teclado — e desenhada por cima dela, entao esta conta devolve de menos e o
//   campo fica parcialmente coberto.
// - `alturaDoTeclado` (`endCoordinates.height`) sai de
//   `WindowInsetsCompat.Type.ime()` (`ReactRootView.java:962`), que conta a
//   janela do IME inteira, faixa incluida. Ela ja desconta a barra de navegacao,
//   que e exatamente o que sobra abaixo da area quando ela termina no fim da
//   safe area — o caso das tres telas que usam este componente.
//
// Ficamos com a maior das duas: a falha que importa e recuar de menos, e cada
// medida e um relato legitimo de onde o teclado comeca. Numa area que nao va ate
// o fim da safe area, `alturaDoTeclado` recuaria um pouco demais.
export function alturaCobertaPeloTeclado({
  fundoDaArea,
  topoDoTeclado,
  alturaDoTeclado,
}: {
  fundoDaArea: number;
  topoDoTeclado: number;
  alturaDoTeclado: number;
}): number {
  return Math.max(fundoDaArea - topoDoTeclado, alturaDoTeclado, 0);
}

// Por que nao usamos o `KeyboardAvoidingView`: a conta dele
// (`KeyboardAvoidingView.js:109`) e
//
//     Math.max(frame.y + frame.height - keyboardY, 0)
//
// e mistura duas origens de coordenada — `frame` vem do `onLayout`, relativo ao
// pai, enquanto `keyboardY` e `endCoordinates.screenY`, de tela. Da para
// compensar com `keyboardVerticalOffset`, mas so se voce souber a que altura da
// janela a area comeca, e medir isso no `onLayout` mede cedo demais: no Chat,
// que monta junto com o app, o `react-native-safe-area-context` ainda podia nao
// ter entregue os insets, e o offset saia curto pela altura da status bar. Era
// por isso que o composer subia e continuava parcialmente coberto.
//
// Aqui medimos no `keyboardDidShow`, com o layout ja assentado, e tiramos as
// duas bordas da mesma origem: `measureInWindow` para o fim da area e
// `endCoordinates.screenY` para o topo do teclado. Sob o edge-to-edge
// obrigatorio do SDK 57 a janela ocupa a tela inteira, entao as duas origens
// coincidem.
export function AreaQueEvitaTeclado({
  style,
  children,
}: {
  style?: StyleProp<ViewStyle>;
  children: ReactNode;
}) {
  const referencia = useRef<ComponentRef<typeof View>>(null);
  const [coberto, setCoberto] = useState(0);

  useEffect(() => {
    const aoMostrar = Keyboard.addListener("keyboardDidShow", (evento) => {
      referencia.current?.measureInWindow((_x, y, _largura, altura) => {
        setCoberto(
          alturaCobertaPeloTeclado({
            fundoDaArea: y + altura,
            topoDoTeclado: evento.endCoordinates.screenY,
            alturaDoTeclado: evento.endCoordinates.height,
          }),
        );
      });
    });
    const aoEsconder = Keyboard.addListener("keyboardDidHide", () => setCoberto(0));

    return () => {
      aoMostrar.remove();
      aoEsconder.remove();
    };
  }, []);

  return (
    <View ref={referencia} testID="caixa-que-evita-o-teclado" collapsable={false} style={style}>
      <View testID="area-que-evita-o-teclado" style={{ flex: 1, paddingBottom: coberto }}>
        {children}
      </View>
    </View>
  );
}

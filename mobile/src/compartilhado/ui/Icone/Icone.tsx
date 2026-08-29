import { Text, type StyleProp, type TextStyle } from "react-native";
import { useTema } from "@/compartilhado/tema";
import { codepoints, type NomeDeIcone } from "./codepoints";

type Props = {
  nome: NomeDeIcone;
  tamanho: number;
  cor?: string;
  preenchido?: boolean;
  estilo?: StyleProp<TextStyle>;
  testID?: string;
};

export function Icone({ nome, tamanho, cor, preenchido = false, estilo, testID }: Props) {
  const { cores } = useTema();

  return (
    <Text
      testID={testID}
      allowFontScaling={false}
      style={[
        {
          fontFamily: preenchido ? "MaterialSymbolsRounded-Fill" : "MaterialSymbolsOutlined",
          fontSize: tamanho,
          lineHeight: tamanho,
          color: cor ?? cores.contorno,
        },
        estilo,
      ]}
    >
      {codepoints[nome]}
    </Text>
  );
}

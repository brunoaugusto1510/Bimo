import { useCallback, useEffect, useRef } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { useEventListener } from "expo";
import { useVideoPlayer, VideoView } from "expo-video";
import { useTema } from "@/compartilhado/tema";

const VIDEO_CLARO = require("../../../assets/videos/intro-claro.mp4");
const VIDEO_ESCURO = require("../../../assets/videos/intro-escuro.mp4");

// Os dois MP4 duram 6,600 s (medido no atom `mvhd`). Meio segundo de folga
// cobre o atraso de carregamento; se o video falhar, o app nao fica preso aqui.
// Na pratica o avanco normal acontece antes disso, pelo evento `playToEnd` do
// player (ou por `statusChange` virando "error"): este timeout e so a rede de
// seguranca para o caso de nenhum dos dois disparar.
const DURACAO_MAXIMA_MS = 7100;

export function Intro() {
  const { cores, tipografia, espacamento, escuro } = useTema();
  const router = useRouter();
  const jaAvancouRef = useRef(false);

  const player = useVideoPlayer(escuro ? VIDEO_ESCURO : VIDEO_CLARO, (instancia) => {
    instancia.loop = false;
    instancia.muted = true;
    instancia.play();
  });

  const avancarParaChat = useCallback(() => {
    if (jaAvancouRef.current) return;
    jaAvancouRef.current = true;
    router.replace("/bimo");
  }, [router]);

  useEventListener(player, "playToEnd", avancarParaChat);
  useEventListener(player, "statusChange", ({ status }) => {
    if (status === "error") avancarParaChat();
  });

  useEffect(() => {
    const id = setTimeout(avancarParaChat, DURACAO_MAXIMA_MS);
    return () => clearTimeout(id);
  }, [avancarParaChat]);

  return (
    <View style={[StyleSheet.absoluteFill, { backgroundColor: cores.fundo }]}>
      <VideoView
        player={player}
        style={StyleSheet.absoluteFill}
        contentFit="cover"
        nativeControls={false}
      />
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Pular"
        onPress={avancarParaChat}
        style={{
          position: "absolute",
          right: espacamento.gutter,
          bottom: 46,
          minHeight: espacamento.alvoDeToque,
          justifyContent: "center",
          paddingHorizontal: espacamento.md,
        }}
      >
        <Text style={[tipografia.rotuloSm, { color: cores.textoTenue }]}>Pular</Text>
      </Pressable>
    </View>
  );
}

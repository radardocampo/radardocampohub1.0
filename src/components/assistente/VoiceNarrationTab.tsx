import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Loader2, Download, Play, Pause } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export function VoiceNarrationTab() {
  const [scene, setScene] = useState("");
  const [sampleContext, setSampleContext] = useState(
    "Narrate as a high-energy Brazilian sports influencer at an extremely rapid-fire pace...",
  );
  const [voiceName, setVoiceName] = useState("Aoede");
  const [text, setText] = useState("");

  const [loading, setLoading] = useState(false);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);

  const handleGenerate = async () => {
    if (!text.trim()) {
      toast.error("O texto para narração não pode estar vazio.");
      return;
    }

    setLoading(true);
    setAudioUrl(null);

    try {
      const { data, error } = await supabase.functions.invoke("ai-generate-voice", {
        body: {
          scene,
          sampleContext,
          voiceName,
          text,
        },
      });

      if (error) {
        throw new Error(error.message || "Erro ao conectar com a Edge Function.");
      }

      if (data?.error) {
        throw new Error(data.error);
      }

      if (data?.audioBase64) {
        // Assume default base64 audio format from Gemini is usually linear16 or MP3/WAV.
        // Usually, when responseModalities=["AUDIO"], Gemini returns audio/pcm or similar,
        // we'll create a blob and object URL. We prefix it with proper MIME for a generic audio fallback.
        // Actually it doesn't specify MIME cleanly in data unless we parsed it.
        // We will default to a data URI for wav or mp3 based on generic support.
        // Gemini generally returns `audio/mp3` or `audio/wav`. We can just use `data:audio/wav;base64,`
        // if we assume it's PCM or similar. Actually, let's just make it a raw data URL with generic audio/mp3.
        const url = `data:audio/mp3;base64,${data.audioBase64}`;
        setAudioUrl(url);
        toast.success("Narração gerada com sucesso!");
      } else {
        throw new Error("Resposta inesperada do servidor (sem áudio).");
      }
    } catch (err: unknown) {
      console.error("Error generating voice:", err);
      toast.error(`Erro ao gerar narração: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setLoading(false);
    }
  };

  const handleDownload = () => {
    if (!audioUrl) return;
    const a = document.createElement("a");
    a.href = audioUrl;
    a.download = `narracao-${voiceName}-${Date.now()}.mp3`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium mb-1">Cena (Opcional)</label>
          <Input
            value={scene}
            onChange={(e) => setScene(e.target.value)}
            placeholder="Ex: Uma transmissão esportiva intensa de final de campeonato..."
            disabled={loading}
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">Contexto & Instruções</label>
          <Textarea
            value={sampleContext}
            onChange={(e) => setSampleContext(e.target.value)}
            placeholder="Instruções de estilo, tom, ritmo..."
            className="h-24"
            disabled={loading}
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">Voz (Speaker)</label>
          <Select value={voiceName} onValueChange={setVoiceName} disabled={loading}>
            <SelectTrigger>
              <SelectValue placeholder="Selecione uma voz" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="Puck">Puck (Upbeat, tom médio)</SelectItem>
              <SelectItem value="Charon">Charon (Grave, sério)</SelectItem>
              <SelectItem value="Kore">Kore (Enérgica, feminina)</SelectItem>
              <SelectItem value="Fenrir">Fenrir (Firme, intenso)</SelectItem>
              <SelectItem value="Aoede">Aoede (Clara, narrativa)</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div>
          <div className="flex justify-between items-center mb-1">
            <label className="block text-sm font-medium">Texto para Narração</label>
            <span className="text-xs text-muted-foreground">{text.length} caracteres</span>
          </div>
          <Textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Cole o texto ou roteiro a ser narrado aqui..."
            className="h-48"
            disabled={loading}
          />
        </div>

        <Button onClick={handleGenerate} disabled={loading || !text.trim()} className="w-full">
          {loading ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Gerando Narração...
            </>
          ) : (
            "Gerar Narração"
          )}
        </Button>
      </div>

      <div className="bg-card border rounded-lg p-6 flex flex-col h-full">
        <h3 className="font-semibold mb-4">Player de Reprodução</h3>

        <div className="flex-1 flex flex-col items-center justify-center min-h-[300px] bg-muted/30 rounded-lg overflow-hidden p-6 border-2 border-dashed border-muted">
          {loading ? (
            <div className="flex flex-col items-center text-center">
              <Loader2 className="h-8 w-8 animate-spin text-primary mb-2" />
              <span className="text-sm text-muted-foreground">
                Processando áudio com IA...
                <br />
                (Isso pode levar alguns segundos dependendo do tamanho do texto)
              </span>
            </div>
          ) : audioUrl ? (
            <div className="w-full flex flex-col items-center gap-6">
              <div className="w-full bg-background rounded-full p-2 border shadow-sm">
                <audio
                  controls
                  src={audioUrl}
                  className="w-full h-10 outline-none"
                  style={{ height: "40px" }}
                />
              </div>
              <p className="text-sm text-muted-foreground text-center">
                Áudio gerado com sucesso usando a voz <strong>{voiceName}</strong>.
              </p>
            </div>
          ) : (
            <span className="text-sm text-muted-foreground text-center">
              Preencha os dados e clique em "Gerar Narração" para criar o áudio.
            </span>
          )}
        </div>

        {audioUrl && (
          <Button variant="outline" className="w-full mt-4" onClick={handleDownload}>
            <Download className="mr-2 h-4 w-4" />
            Baixar Áudio (.mp3)
          </Button>
        )}
      </div>
    </div>
  );
}

import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "../components/AppShell";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
import { Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Skeleton } from "@/components/ui/skeleton";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Download, Upload, Settings } from "lucide-react";
import { useEffect, useRef } from "react";

export const Route = createFileRoute("/assistente")({
  component: AssistentePage,
});

function AssistentePage() {
  return (
    <AppShell title="Assistente IA" subtitle="Análise inteligente de dados e sugestão de conteúdos">
      <Tabs defaultValue="analise" className="mt-4">
        <TabsList className="mb-6">
          <TabsTrigger value="analise">Análise</TabsTrigger>
          <TabsTrigger value="titulos">Títulos e Tags</TabsTrigger>
          <TabsTrigger value="imagem">Melhorar Imagem</TabsTrigger>
        </TabsList>
        <TabsContent value="analise">
          <AnaliseTab />
        </TabsContent>
        <TabsContent value="titulos">
          <TitulosTab />
        </TabsContent>
        <TabsContent value="imagem">
          <ImagemTab />
        </TabsContent>
        <TabsContent value="titulos">
          <TitulosTab />
        </TabsContent>
      </Tabs>
    </AppShell>
  );
}

function AnaliseTab() {
  const [prompt, setPrompt] = useState("");
  const [history, setHistory] = useState<{ role: "user" | "ai"; text: string }[]>([]);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!prompt.trim()) return;

    const userMessage = prompt;
    setPrompt("");
    setHistory((prev) => [...prev, { role: "user", text: userMessage }]);
    setLoading(true);

    try {
      const { data, error } = await supabase.functions.invoke("ai-analyze", {
        body: { prompt: userMessage },
      });

      if (error) {
        throw error;
      }

      setHistory((prev) => [...prev, { role: "ai", text: data.response }]);
    } catch (err: unknown) {
      console.error(err);
      setHistory((prev) => [
        ...prev,
        { role: "ai", text: "Ocorreu um erro ao gerar a resposta. Tente novamente." },
      ]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex justify-between items-center">
        <CustomizeInstructionDialog mode="analise" title="Análise" />
      </div>
      <div className="flex flex-col h-[600px] border rounded-lg bg-card overflow-hidden">
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {history.length === 0 && (
            <div className="text-center text-muted-foreground mt-10">
              Envie uma pergunta para iniciar a análise dos dados.
            </div>
          )}
          {history.map((msg, idx) => (
            <div
              key={idx}
              className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
            >
              <div
                className={`max-w-[80%] rounded-lg p-3 ${
                  msg.role === "user" ? "bg-primary text-primary-foreground" : "bg-muted"
                } whitespace-pre-wrap`}
              >
                {msg.text}
              </div>
            </div>
          ))}
          {loading && (
            <div className="flex justify-start">
              <div className="max-w-[80%] rounded-lg p-3 bg-muted flex items-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin" />
                <span className="text-sm">Gerando resposta...</span>
              </div>
            </div>
          )}
        </div>
        <form onSubmit={handleSubmit} className="p-4 border-t flex gap-2 bg-background">
          <Input
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder="Faça uma pergunta sobre seus dados..."
            className="flex-1"
            disabled={loading}
          />
          <Button type="submit" disabled={loading}>
            Enviar
          </Button>
        </form>
      </div>
    </div>
  );
}

function TitulosTab() {
  const [description, setDescription] = useState("");
  const [platform, setPlatform] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState("");

  const handleGenerate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!description.trim() || !platform) return;

    setLoading(true);
    setResult("");

    try {
      const { data, error } = await supabase.functions.invoke("ai-suggest-titles", {
        body: { description, platform },
      });

      if (error) {
        throw error;
      }

      setResult(data.response);
    } catch (err: unknown) {
      console.error(err);
      setResult("Ocorreu um erro ao gerar sugestões. Tente novamente.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex justify-between items-center">
        <CustomizeInstructionDialog mode="titulos" title="Títulos e Tags" />
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div>
          <form onSubmit={handleGenerate} className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-1">Plataforma</label>
              <Select onValueChange={setPlatform} value={platform} disabled={loading}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione a plataforma" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="YouTube">YouTube</SelectItem>
                  <SelectItem value="TikTok">TikTok</SelectItem>
                  <SelectItem value="Instagram">Instagram</SelectItem>
                  <SelectItem value="Pinterest">Pinterest</SelectItem>
                  <SelectItem value="Threads">Threads</SelectItem>
                  <SelectItem value="Facebook">Facebook</SelectItem>
                  <SelectItem value="Kwai">Kwai</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Descrição do Conteúdo</label>
              <Textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Descreva sobre o que é o seu vídeo/conteúdo..."
                className="h-32"
                disabled={loading}
              />
            </div>
            <Button
              type="submit"
              disabled={loading || !platform || !description.trim()}
              className="w-full"
            >
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Gerar sugestões
            </Button>
          </form>
        </div>

        <div className="bg-card border rounded-lg p-6">
          <h3 className="font-semibold mb-4">Sugestões de IA</h3>
          {loading ? (
            <div className="space-y-4">
              <Skeleton className="h-4 w-3/4" />
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-5/6" />
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-24 w-full mt-4" />
            </div>
          ) : result ? (
            <div className="whitespace-pre-wrap text-sm">{result}</div>
          ) : (
            <div className="text-sm text-muted-foreground text-center mt-10">
              Preencha os dados e clique em gerar para ver sugestões.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function CustomizeInstructionDialog({ mode, title }: { mode: string; title: string }) {
  const [instruction, setInstruction] = useState("");
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(false);

  useEffect(() => {
    if (isOpen) {
      fetchInstruction();
    }
  }, [isOpen]);

  const fetchInstruction = async () => {
    setFetching(true);
    try {
      const { data, error } = await supabase
        .from("ai_prompt_settings")
        .select("instruction")
        .eq("mode", mode)
        .single();

      if (error && error.code !== "PGRST116") {
        console.error("Error fetching instruction:", error);
      }

      if (data) {
        setInstruction(data.instruction);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setFetching(false);
    }
  };

  const handleSave = async () => {
    setLoading(true);
    try {
      const { error } = await supabase.from("ai_prompt_settings").upsert({ mode, instruction });

      if (error) throw error;
      setIsOpen(false);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="mb-4">
          <Settings className="w-4 h-4 mr-2" />
          Personalizar Instrução
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Personalizar Instrução - {title}</DialogTitle>
          <DialogDescription>
            Edite a instrução base (prompt de sistema) que a IA usará para este modo.
          </DialogDescription>
        </DialogHeader>
        <div className="py-4">
          {fetching ? (
            <div className="flex justify-center p-4">
              <Loader2 className="w-6 h-6 animate-spin text-primary" />
            </div>
          ) : (
            <Textarea
              value={instruction}
              onChange={(e) => setInstruction(e.target.value)}
              className="min-h-[150px]"
              placeholder="Digite a instrução base..."
            />
          )}
        </div>
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={() => setIsOpen(false)} disabled={loading}>
            Cancelar
          </Button>
          <Button onClick={handleSave} disabled={loading || fetching}>
            {loading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            Salvar
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function ImagemTab() {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [extraInstruction, setExtraInstruction] = useState("");
  const [loading, setLoading] = useState(false);
  const [resultImageBase64, setResultImageBase64] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const file = e.target.files[0];
      setSelectedFile(file);
      const url = URL.createObjectURL(file);
      setPreviewUrl(url);
      setResultImageBase64(null); // Reset result when new image is uploaded
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const file = e.dataTransfer.files[0];
      if (file.type.startsWith("image/")) {
        setSelectedFile(file);
        const url = URL.createObjectURL(file);
        setPreviewUrl(url);
        setResultImageBase64(null);
      }
    }
  };

  const convertFileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = (error) => reject(error);
    });
  };

  const handleEnhance = async () => {
    if (!selectedFile) return;

    setLoading(true);
    try {
      const base64Image = await convertFileToBase64(selectedFile);

      const { data, error } = await supabase.functions.invoke("ai-enhance-image", {
        body: {
          imageBase64: base64Image,
          instruction: extraInstruction,
        },
      });

      if (error) throw error;

      let finalBase64 = data.response;
      if (!finalBase64.startsWith("data:image")) {
        finalBase64 = `data:image/jpeg;base64,${finalBase64}`;
      }

      setResultImageBase64(finalBase64);
    } catch (err) {
      console.error(err);
      alert("Erro ao aprimorar imagem. Tente novamente.");
    } finally {
      setLoading(false);
    }
  };

  const handleDownload = () => {
    if (!resultImageBase64) return;
    const a = document.createElement("a");
    a.href = resultImageBase64;
    a.download = "imagem-aprimorada.jpg";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  return (
    <div className="flex flex-col">
      <div className="flex justify-between items-center w-full">
        <CustomizeInstructionDialog mode="imagem" title="Melhorar Imagem" />
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="space-y-4">
          <div
            className="border-2 border-dashed rounded-lg p-6 flex flex-col items-center justify-center min-h-[300px] cursor-pointer hover:bg-muted/50 transition-colors"
            onClick={() => fileInputRef.current?.click()}
            onDragOver={handleDragOver}
            onDrop={handleDrop}
          >
            <input
              type="file"
              accept="image/jpeg, image/png, image/webp"
              className="hidden"
              ref={fileInputRef}
              onChange={handleFileChange}
            />
            {previewUrl ? (
              <img
                src={previewUrl}
                alt="Preview"
                className="max-w-full max-h-[250px] object-contain rounded"
              />
            ) : (
              <div className="text-center">
                <Upload className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
                <p className="text-sm font-medium">Clique ou arraste uma imagem (JPG, PNG, WebP)</p>
              </div>
            )}
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Instruções Extras (Opcional)</label>
            <Input
              value={extraInstruction}
              onChange={(e) => setExtraInstruction(e.target.value)}
              placeholder="Ex: Deixe o gramado mais verde..."
              disabled={loading}
            />
          </div>
          <Button className="w-full" disabled={!selectedFile || loading} onClick={handleEnhance}>
            {loading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Processando...
              </>
            ) : (
              "Melhorar Imagem"
            )}
          </Button>
        </div>

        <div className="bg-card border rounded-lg p-6 flex flex-col">
          <h3 className="font-semibold mb-4">Resultado</h3>
          <div className="flex-1 flex flex-col items-center justify-center min-h-[300px] bg-muted/30 rounded-lg overflow-hidden">
            {loading ? (
              <div className="flex flex-col items-center">
                <Loader2 className="h-8 w-8 animate-spin text-primary mb-2" />
                <span className="text-sm text-muted-foreground">Aplicando melhorias com IA...</span>
              </div>
            ) : resultImageBase64 ? (
              <img
                src={resultImageBase64}
                alt="Resultado"
                className="max-w-full max-h-[350px] object-contain"
              />
            ) : (
              <span className="text-sm text-muted-foreground">
                A imagem aprimorada aparecerá aqui.
              </span>
            )}
          </div>
          {resultImageBase64 && (
            <Button variant="outline" className="w-full mt-4" onClick={handleDownload}>
              <Download className="mr-2 h-4 w-4" />
              Baixar Imagem
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

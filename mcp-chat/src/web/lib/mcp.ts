// Conexión del host (navegador) con el servidor MCP por Streamable HTTP.
import { Client, StreamableHTTPClientTransport, type CallToolResult, type Tool } from "@modelcontextprotocol/client";
import { getToolUiResourceUri, isToolVisibilityAppOnly, isToolVisibilityModelOnly, RESOURCE_MIME_TYPE } from "@modelcontextprotocol/ext-apps/app-bridge";
import type { McpUiResourceCsp, McpUiResourceMeta, McpUiResourcePermissions } from "@modelcontextprotocol/ext-apps";

export interface UiResource {
  html: string;
  csp?: McpUiResourceCsp;
  permissions?: McpUiResourcePermissions;
  prefersBorder?: boolean;
}

export interface PromptInfo {
  name: string;
  title?: string;
  description?: string;
}

export class McpConnection {
  client: Client;
  tools: Tool[] = [];
  prompts: PromptInfo[] = [];
  serverName = "";
  instructions = "";
  private resources = new Map<string, Promise<UiResource>>();

  constructor(readonly url: string) {
    this.client = new Client(
      { name: "mcp-chat", title: "MCP Chat", version: "1.0.0" },
      // Anunciamos soporte de MCP Apps (extensión io.modelcontextprotocol/ui).
      { capabilities: { extensions: { "io.modelcontextprotocol/ui": { mimeTypes: [RESOURCE_MIME_TYPE] } } } as never },
    );
  }

  async connect() {
    await this.client.connect(new StreamableHTTPClientTransport(new URL(this.url, location.href)));
    const v = this.client.getServerVersion();
    this.serverName = (v?.title as string) || v?.name || "Servidor MCP";
    this.instructions = this.client.getInstructions() ?? "";
    this.tools = (await this.client.listTools()).tools;
    try {
      this.prompts = (await this.client.listPrompts()).prompts;
    } catch {
      this.prompts = [];
    }
  }

  tool(name: string) {
    return this.tools.find((t) => t.name === name);
  }
  uiUriFor(name: string) {
    const t = this.tool(name);
    return t ? getToolUiResourceUri(t) : undefined;
  }
  /** Herramientas que ve el modelo (excluye las de visibilidad solo "app"). */
  modelTools() {
    return this.tools.filter((t) => !isToolVisibilityAppOnly(t));
  }
  canAppCall(name: string) {
    const t = this.tool(name);
    return !!t && !isToolVisibilityModelOnly(t);
  }

  async callTool(name: string, args: Record<string, unknown>): Promise<CallToolResult> {
    try {
      return (await this.client.callTool({ name, arguments: args })) as CallToolResult;
    } catch (e) {
      return { isError: true, content: [{ type: "text", text: `Error llamando a ${name}: ${(e as Error).message}` }] };
    }
  }

  async promptText(name: string) {
    const p = await this.client.getPrompt({ name });
    return p.messages
      .map((m) => (m.content.type === "text" ? m.content.text : ""))
      .filter(Boolean)
      .join("\n");
  }

  /** Lee (y cachea) el recurso HTML de un widget, con su _meta.ui (CSP, permisos…). */
  uiResource(uri: string): Promise<UiResource> {
    let p = this.resources.get(uri);
    if (!p) {
      p = (async () => {
        const res = await this.client.readResource({ uri });
        const c = res.contents.find((x) => x.uri === uri) ?? res.contents[0];
        if (!c || !("text" in c)) throw new Error(`Recurso ${uri} sin HTML`);
        const meta = ((c._meta as { ui?: McpUiResourceMeta } | undefined)?.ui ?? {}) as McpUiResourceMeta;
        return { html: c.text, csp: meta.csp, permissions: meta.permissions, prefersBorder: meta.prefersBorder };
      })();
      this.resources.set(uri, p);
      p.catch(() => this.resources.delete(uri));
    }
    return p;
  }
}

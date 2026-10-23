/**
 * openuiParser.ts - Progressive Generative UI (OpenUI) Streaming AST Parser
 * Converts streaming OpenUI DSL tags into an evolving Abstract Syntax Tree (AST)
 * for frame-by-frame progressive hydration inside Obsidian/Gold cards.
 */

export interface OpenUINode {
  type: string;
  props: Record<string, any>;
  children: OpenUINode[];
  isComplete: boolean;
  rawTag?: string;
}

export interface ParseResult {
  text: string;
  dynamicCard: OpenUINode | null;
  isStreaming: boolean;
}

export class StreamingOpenUIParser {
  private buffer: string = "";
  private rootNode: OpenUINode | null = null;

  constructor() {
    this.reset();
  }

  public reset(): void {
    this.buffer = "";
    this.rootNode = null;
  }

  /**
   * Incremental chunk processor for SSE streaming tokens.
   */
  public processChunk(chunk: string): ParseResult {
    this.buffer += chunk;
    return this.parseBuffer();
  }

  /**
   * Snapshot parser for static or accumulated message strings.
   */
  public parseFullText(fullText: string): ParseResult {
    this.buffer = fullText || "";
    this.rootNode = null;
    return this.parseBuffer();
  }

  private parseBuffer(): ParseResult {
    if (!this.buffer) {
      return { text: "", dynamicCard: null, isStreaming: false };
    }

    // 1. Check for opening <tactical_card ...> tag
    const cardMatch = this.buffer.match(/<tactical_card\s+([^>]*?)>/i);
    if (cardMatch) {
      const rawAttrs = cardMatch[1];
      const props = this.extractAttributes(rawAttrs);
      const cardType = (props.type as string) || "ledger";

      if (!this.rootNode || this.rootNode.type !== cardType) {
        this.rootNode = {
          type: cardType,
          props: {
            title: props.title || "Tactical Police Intelligence",
            statute: props.statute || "§ 63 BSA 2023",
            category: props.category || "PROGRESSIVE OPENUI STREAM",
            tokenId: props.token_id || props.id || "#OPENUI-STREAM",
            ...props
          },
          children: [],
          isComplete: false,
          rawTag: cardMatch[0]
        };
      } else {
        // Incrementally merge new attributes on the root node
        this.rootNode.props = {
          ...this.rootNode.props,
          ...props
        };
      }
    }

    // 2. Extract child elements (<entry ... />)
    if (this.rootNode) {
      // Matches both self-closing <entry ... /> and paired <tag ...>...</tag>
      const childRegex = /<([a-zA-Z0-9_]+)\s+([^>]*?)(?:\/>|>(.*?)<\/\1>)/gi;
      let match: RegExpExecArray | null;

      const openTagIdx = this.buffer.indexOf(this.rootNode.rawTag || "<tactical_card");
      const contentSlice = openTagIdx !== -1 ? this.buffer.slice(openTagIdx) : this.buffer;

      while ((match = childRegex.exec(contentSlice)) !== null) {
        const tagName = match[1].toLowerCase();
        if (tagName === "tactical_card") continue;

        const rawChildAttrs = match[2];
        const childInnerContent = match[3];
        const childProps = this.extractAttributes(rawChildAttrs);

        if (childInnerContent && !childProps.content) {
          childProps.content = childInnerContent.trim();
        }

        const nodeSignature = `${tagName}:${JSON.stringify(childProps)}`;
        const exists = this.rootNode.children.some(
          (c) => `${c.type}:${JSON.stringify(c.props)}` === nodeSignature
        );

        if (!exists) {
          this.rootNode.children.push({
            type: tagName,
            props: childProps,
            children: [],
            isComplete: true
          });
        }
      }

      // 3. Check for closing </tactical_card> tag
      if (/<\/tactical_card>/i.test(this.buffer)) {
        this.rootNode.isComplete = true;
      }
    }

    // 4. Strip raw DSL tags for clean conversational bubble prose
    const cleanText = this.buffer
      .replace(/<tactical_card\s+[^>]*?>/gi, "")
      .replace(/<\/tactical_card>/gi, "")
      .replace(/<[a-zA-Z0-9_]+\s+[^>]*?\/>/gi, "")
      .replace(/<[a-zA-Z0-9_]+\s+[^>]*?>.*?<\/[a-zA-Z0-9_]+>/gi, "")
      .replace(/\n\s*\n\s*\n/g, "\n\n")
      .trim();

    // Return an immutable snapshot for clean React frame-by-frame hydration
    const dynamicCardSnapshot: OpenUINode | null = this.rootNode
      ? {
          type: this.rootNode.type,
          props: { ...this.rootNode.props },
          children: this.rootNode.children.map((c) => ({
            type: c.type,
            props: { ...c.props },
            children: [...c.children],
            isComplete: c.isComplete
          })),
          isComplete: this.rootNode.isComplete,
          rawTag: this.rootNode.rawTag
        }
      : null;

    return {
      text: cleanText,
      dynamicCard: dynamicCardSnapshot,
      isStreaming: this.rootNode ? !this.rootNode.isComplete : false
    };
  }

  private extractAttributes(attrString: string): Record<string, string> {
    const props: Record<string, string> = {};
    if (!attrString) return props;

    const propRegex = /([a-zA-Z0-9_\-]+)=(?:["']([^"']*)["']|([^\s>]+))/g;
    let m: RegExpExecArray | null;
    while ((m = propRegex.exec(attrString)) !== null) {
      const key = m[1];
      const val = m[2] !== undefined ? m[2] : m[3];
      props[key] = val;
    }
    return props;
  }
}

/**
 * Standalone snapshot helper function
 */
export function parseOpenUIText(rawText: string): ParseResult {
  const parser = new StreamingOpenUIParser();
  return parser.parseFullText(rawText);
}

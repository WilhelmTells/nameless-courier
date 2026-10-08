// Full-screen overlays: the title, the opening and the ending. Plain text
// and buttons for now; the look comes later.

export interface MenuItem {
  label: string;
  action: () => void;
}

export class Screens {
  private readonly root: HTMLDivElement;
  private readonly heading: HTMLDivElement;
  private readonly text: HTMLDivElement;
  private readonly info: HTMLDivElement;
  private readonly menu: HTMLDivElement;
  private lines: HTMLParagraphElement[] = [];

  constructor() {
    const div = (id: string, parent: HTMLElement) => {
      const el = document.createElement("div");
      el.id = id;
      parent.appendChild(el);
      return el;
    };
    this.root = div("screen", document.body);
    this.heading = div("screen-heading", this.root);
    this.text = div("screen-text", this.root);
    this.info = div("screen-info", this.root);
    this.menu = div("screen-menu", this.root);
    this.hide();
  }

  hide(): void {
    this.root.hidden = true;
  }

  /** Shows the overlay, empty, over a black of `black` (0 = see-through, 1 = black). */
  show(black: number): void {
    this.root.hidden = false;
    this.heading.textContent = "";
    this.info.textContent = "";
    this.setLines([]);
    this.setMenu([]);
    this.setBlack(black);
    this.setFade(1);
  }

  setBlack(black: number): void {
    this.root.style.backgroundColor = `rgba(0, 0, 0, ${black})`;
  }

  /** Fades the whole overlay, text included (1 = fully there). */
  setFade(opacity: number): void {
    this.root.style.opacity = String(opacity);
  }

  /** The title and a menu. */
  title(name: string, items: MenuItem[]): void {
    this.show(0.6);
    this.heading.textContent = name;
    this.setMenu(items);
  }

  /** A question with a menu of answers. */
  ask(question: string, items: MenuItem[]): void {
    this.show(0.6);
    this.info.textContent = question;
    this.setMenu(items);
  }

  /** Prepares lines of text, all hidden; reveal them with `reveal`. */
  setLines(lines: readonly string[]): void {
    this.text.replaceChildren();
    this.lines = lines.map((line) => {
      const p = document.createElement("p");
      p.textContent = line;
      this.text.appendChild(p);
      return p;
    });
  }

  /** Shows the first `count` lines; they fade in. */
  reveal(count: number): void {
    this.lines.forEach((p, i) => p.classList.toggle("shown", i < count));
  }

  /** Text under the lines, such as the run's stats. */
  setInfo(text: string): void {
    this.info.textContent = text;
  }

  setMenu(items: MenuItem[]): void {
    this.menu.replaceChildren(
      ...items.map(({ label, action }) => {
        const button = document.createElement("button");
        button.textContent = label;
        button.addEventListener("click", action);
        return button;
      }),
    );
  }

  /** True once the menu has buttons. */
  hasMenu(): boolean {
    return this.menu.childElementCount > 0;
  }
}

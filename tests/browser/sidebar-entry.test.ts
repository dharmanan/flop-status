import { describe, expect, it } from "vitest";
import { ensureSidebarEntry } from "../../web/sidebar-entry.js";

class FakeNode {
  readonly tag: string;
  readonly className: string;
  parentNode: FakeSidebar | null = null;

  constructor(tag: string, className = "") {
    this.tag = tag;
    this.className = className;
  }

  get isConnected(): boolean {
    return this.parentNode !== null;
  }

  matches(selector: string): boolean {
    return selector === `.${this.className}`;
  }
}

class FakeSidebar {
  children: FakeNode[] = [];

  querySelector(selector: string): FakeNode | null {
    return this.children.find((child) => child.matches(selector)) ?? null;
  }

  insertBefore(node: FakeNode, reference: FakeNode | null): FakeNode {
    node.parentNode = this;
    const index = reference ? this.children.indexOf(reference) : -1;
    if (index === -1) this.children.push(node);
    else this.children.splice(index, 0, node);
    return node;
  }
}

describe("ensureSidebarEntry (Mailbox / Agent Network / Deals language-switch fix)", () => {
  it("creates and inserts an entry when none exists yet", () => {
    const sidebar = new FakeSidebar();
    const productNav = new FakeNode("nav", "product-nav");
    sidebar.insertBefore(productNav, null);
    let created = 0;
    const makeEntry = () => { created += 1; return new FakeNode("button", "mailbox-entry"); };

    const entry = ensureSidebarEntry(sidebar, null, makeEntry, [".network-entry", ".product-nav"]);

    expect(created).toBe(1);
    expect(entry.isConnected).toBe(true);
    expect(sidebar.children).toEqual([entry, productNav]);
  });

  it("returns the existing entry unchanged when it is still connected (idempotent, no duplicate)", () => {
    const sidebar = new FakeSidebar();
    const productNav = new FakeNode("nav", "product-nav");
    sidebar.insertBefore(productNav, null);
    let created = 0;
    const makeEntry = () => { created += 1; return new FakeNode("button", "mailbox-entry"); };
    const first = ensureSidebarEntry(sidebar, null, makeEntry, [".product-nav"]);

    const second = ensureSidebarEntry(sidebar, first, makeEntry, [".product-nav"]);

    expect(second).toBe(first);
    expect(created).toBe(1);
    expect(sidebar.children.filter((child) => child === first)).toHaveLength(1);
  });

  it("re-creates and re-inserts the entry every time its sidebar is replaced, across repeated language switches", () => {
    let entry: FakeNode | null = null;
    let created = 0;
    const makeEntry = () => { created += 1; return new FakeNode("button", "mailbox-entry"); };

    // app-shell.js's refreshLocalization() replaces `.product-sidebar` wholesale on every
    // TR<->EN toggle. Simulate five such toggles by handing ensureSidebarEntry a brand new
    // sidebar each cycle, exactly like the real language-switch handler now does via bind().
    for (let cycle = 0; cycle < 5; cycle += 1) {
      // Real DOM: replacing the old sidebar node also detaches everything inside
      // it (including the previous entry) from the document, not just from that
      // one node's immediate parent reference.
      if (entry) entry.parentNode = null;
      const sidebar = new FakeSidebar();
      const productNav = new FakeNode("nav", "product-nav");
      sidebar.insertBefore(productNav, null);

      entry = ensureSidebarEntry(sidebar, entry, makeEntry, [".network-entry", ".product-nav"]);

      expect(entry.isConnected).toBe(true);
      expect(sidebar.children.filter((child) => child.className === "mailbox-entry")).toHaveLength(1);
    }

    expect(created).toBe(5); // one fresh entry per sidebar replacement — never zero, never more than one
  });

  it("positions the entry before the first existing sibling entry, in priority order", () => {
    const sidebar = new FakeSidebar();
    const productNav = new FakeNode("nav", "product-nav");
    const networkEntry = new FakeNode("button", "network-entry");
    sidebar.insertBefore(networkEntry, null);
    sidebar.insertBefore(productNav, null);
    const makeEntry = () => new FakeNode("button", "mailbox-entry");

    const entry = ensureSidebarEntry(sidebar, null, makeEntry, [".network-entry", ".product-nav"]);

    expect(sidebar.children.indexOf(entry)).toBeLessThan(sidebar.children.indexOf(networkEntry));
  });
});

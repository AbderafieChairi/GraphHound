import { expect, test } from "bun:test";
import { rowsToElements } from "../src/lib/graph-elements";

test("builds nodes and edges from a path", () => {
  const a = { objectid: "A", name: "alice", kind: "User" };
  const b = { objectid: "B", name: "admins", kind: "Group" };
  const els = rowsToElements([{ p: { nodes: [a, b], edges: [{ label: "MemberOf" }] } }]);
  const ids = els.map((e) => e.data.id);
  expect(ids).toContain("A");
  expect(ids).toContain("B");
  expect(ids).toContain("A|MemberOf|B");
});

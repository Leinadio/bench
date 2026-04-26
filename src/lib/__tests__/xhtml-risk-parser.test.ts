import { parseXhtmlRiskFactors } from "../xhtml-risk-parser";
import path from "path";
import fs from "fs";
import os from "os";

function makeFixture(content: string): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "xhtml-parser-"));
  const filePath = path.join(dir, "test.xhtml");
  fs.writeFileSync(filePath, content, "utf-8");
  return filePath;
}

const MINIMAL_XHTML = `<?xml version="1.0"?>
<html>
<body>
<p><a id="_Toc000000001">1.    Facteurs de risques</a></p>
<div class="wrapper">
<table border="0">
  <tr>
    <td rowspan="2" style="padding-left: 0px">
      <p>Cat A</p>
    </td>
    <td><p>Risk One</p></td>
    <td style="background-color: rgb(220, 222, 227)"><p>1</p></td>
    <td><p>1.1.1</p></td>
  </tr>
  <tr>
    <td><p>Risk Two</p></td>
    <td style="background-color: rgb(220, 222, 227)"><p>2</p></td>
    <td><p>1.1.2</p></td>
  </tr>
</table>
</div>
<p class="titre"><a id="_Toc000000002">1.1         Cat A</a></p>
<p class="titre">1.1.1       Risk One</p>
<div class="wrapper">
<table class="textes">
  <tr><td><p style="font-weight:700">Description du risque</p></td><td><p style="font-weight:700">Gestion du risque</p></td></tr>
  <tr>
    <td><p class="serif">Description of risk one.</p></td>
    <td><p class="puce serif"><span>&#x25CF;  </span>Management of risk one.</p></td>
  </tr>
</table>
</div>
<p class="titre">1.1.2       Risk Two</p>
<div class="wrapper">
<table class="textes">
  <tr><td><p style="font-weight:700">Description du risque</p></td><td><p style="font-weight:700">Gestion du risque</p></td></tr>
  <tr>
    <td><p class="serif">Description of risk two.</p></td>
    <td><p class="puce serif"><span>&#x25CF;  </span>Management of risk two.</p></td>
  </tr>
</table>
</div>
<p class="titre"><a id="_Toc000000099">2.    Politique d&apos;assurance</a></p>
</body>
</html>`;

describe("parseXhtmlRiskFactors", () => {
  it("returns one category with two factors", () => {
    const fp = makeFixture(MINIMAL_XHTML);
    const result = parseXhtmlRiskFactors(fp);
    expect(result).toHaveLength(1);
    expect(result[0].name).toBe("Cat A");
    expect(result[0].factors).toHaveLength(2);
  });

  it("extracts section refs and titles", () => {
    const fp = makeFixture(MINIMAL_XHTML);
    const [cat] = parseXhtmlRiskFactors(fp);
    expect(cat.factors[0].sectionRef).toBe("1.1.1");
    expect(cat.factors[0].title).toBe("Risk One");
    expect(cat.factors[1].sectionRef).toBe("1.1.2");
    expect(cat.factors[1].title).toBe("Risk Two");
  });

  it("reads criticality from summary table", () => {
    const fp = makeFixture(MINIMAL_XHTML);
    const [cat] = parseXhtmlRiskFactors(fp);
    expect(cat.factors[0].criticalityScore).toBe(1);
    expect(cat.factors[1].criticalityScore).toBe(2);
  });

  it("extracts description and risk management into items", () => {
    const fp = makeFixture(MINIMAL_XHTML);
    const [cat] = parseXhtmlRiskFactors(fp);
    expect(cat.factors[0].items).toHaveLength(1);
    expect(cat.factors[0].items[0].description).toContain("Description of risk one");
    expect(cat.factors[0].items[0].riskManagement).toContain("Management of risk one");
  });

  it("strips HTML tags from content", () => {
    const fp = makeFixture(MINIMAL_XHTML);
    const [cat] = parseXhtmlRiskFactors(fp);
    expect(cat.factors[0].items[0].description).not.toContain("<");
    expect(cat.factors[0].items[0].riskManagement).not.toContain("<");
  });
});

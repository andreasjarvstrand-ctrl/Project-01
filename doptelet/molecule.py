# Generates molecule.json: a 3D conformer of avatrombopag (heavy atoms) and maleic acid,
# with fragment assignment and true masses. Run: python3 molecule.py
import json
import numpy as np
from rdkit import Chem
from rdkit.Chem import AllChem, Descriptors, rdMolDescriptors

AVA = "OC(=O)C1CCN(CC1)c1ncc(cc1Cl)C(=O)Nc1nc(c(s1)N1CCN(CC1)C1CCCCC1)-c1cc(Cl)cs1"
MALEATE = "OC(=O)/C=C\\C(=O)O"

# Building blocks, matched as substructures in order; each atom goes to the first match.
FRAGMENTS = [
    ("acid", "Piperidine-4-carboxylic acid", "OC(=O)C1CCNCC1"),
    ("pyridine", "3-Chloropyridine carboxamide", "c1ncc(cc1Cl)C(=O)N"),
    ("thiazole", "1,3-Thiazole", "c1ncsc1"),
    ("thiophene", "4-Chlorothiophene", "c1cc(Cl)cs1"),
    ("piperazine", "Piperazine", "N1CCNCC1"),
    ("cyclohexyl", "Cyclohexyl", "C1CCCCC1"),
]

def conformer(smiles, seed):
    mol = Chem.AddHs(Chem.MolFromSmiles(smiles))
    AllChem.EmbedMolecule(mol, randomSeed=seed)
    AllChem.MMFFOptimizeMolecule(mol, maxIters=2000)
    return mol

def principal(xyz):
    centre = xyz.mean(axis=0)
    _, _, vt = np.linalg.svd(xyz - centre)
    out = (xyz - centre) @ vt.T
    return out

ava = conformer(AVA, 7)
heavy = [a.GetIdx() for a in ava.GetAtoms() if a.GetAtomicNum() > 1]
pos = ava.GetConformer().GetPositions()
xyz = principal(pos[heavy])
index = {old: new for new, old in enumerate(heavy)}

owner = {}
core = Chem.RemoveHs(ava)
kek = Chem.Mol(core)
Chem.Kekulize(kek, clearAromaticFlags=True)
for key, _, smarts in FRAGMENTS:
    patt = Chem.MolFromSmarts(smarts)
    for match in core.GetSubstructMatches(patt):
        if all(i not in owner for i in match):
            for i in match:
                owner[i] = key
            break
assert len(owner) == core.GetNumAtoms(), (len(owner), core.GetNumAtoms())

def hcount(mol, i):
    return mol.GetAtomWithIdx(i).GetTotalNumHs()

masses = {}
formula = {}
for key, *_ in FRAGMENTS:
    atoms = [i for i in owner if owner[i] == key]
    m = 0.0
    counts = {}
    for i in atoms:
        a = core.GetAtomWithIdx(i)
        m += a.GetMass() + hcount(core, i) * 1.008
        counts[a.GetSymbol()] = counts.get(a.GetSymbol(), 0) + 1
        counts["H"] = counts.get("H", 0) + hcount(core, i)
    masses[key] = round(m, 2)
    formula[key] = counts

atoms = [{"el": core.GetAtomWithIdx(i).GetSymbol(), "p": [round(float(v), 3) for v in xyz[i]], "frag": owner[i]} for i in range(core.GetNumAtoms())]
bonds = [[b.GetBeginAtomIdx(), b.GetEndAtomIdx(), int(b.GetBondTypeAsDouble())] for b in kek.GetBonds()]

mal = Chem.RemoveHs(conformer(MALEATE, 3))
mxyz = principal(mal.GetConformer().GetPositions())
maleate = {
    "atoms": [{"el": a.GetSymbol(), "p": [round(float(v), 3) for v in mxyz[a.GetIdx()]]} for a in mal.GetAtoms()],
    "bonds": [[b.GetBeginAtomIdx(), b.GetEndAtomIdx(), 2 if b.GetBondTypeAsDouble() == 2 else 1] for b in mal.GetBonds()],
    "mass": round(Descriptors.MolWt(mal), 2),
    "formula": rdMolDescriptors.CalcMolFormula(mal),
}

out = {
    "formula": rdMolDescriptors.CalcMolFormula(core),
    "mass": round(Descriptors.MolWt(core), 2),
    "fragments": [{"key": k, "name": n, "mass": masses[k], "count": formula[k]} for k, n, _ in FRAGMENTS],
    "atoms": atoms,
    "bonds": bonds,
    "maleate": maleate,
}
json.dump(out, open("molecule.json", "w"), indent=1)
print(out["formula"], out["mass"], maleate["formula"], maleate["mass"], sum(masses.values()))
for f in out["fragments"]: print(f)
print("extent", xyz.min(0), xyz.max(0))

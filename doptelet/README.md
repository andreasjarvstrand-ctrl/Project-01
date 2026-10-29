# Doptelet: molecular model

An interactive isometric figure of avatrombopag maleate, the active ingredient in Doptelet (Sobi). It shows a ball-and-stick model of avatrombopag on a bench stand, with a maleic-acid carriage that docks to form the salt. A 20 mg tablet sits in front.

- `molecule.py` uses RDKit to make an MMFF-optimised 3D conformer, split it into six building blocks and compute their masses. It writes `molecule.json`.
- `build.mjs` builds `doptelet.html` (dark theme). Run it with `--light` to build `doptelet-light.html` instead.
- `kit/` is the vendored isometric drawing kit.

```
pip install rdkit && python3 molecule.py   # optional: regenerate molecule.json
node build.mjs && node build.mjs --light
```

To use it, hover a ring to see its formula and its share of the molecular mass. Click, or press Enter, to dock or undock the maleate. The arrow keys step through the building blocks.

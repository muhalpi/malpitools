# malpitools

malpitools is a modified fork of delphitools: a collection of small, low stakes and low effort tools.
No logins, no registration, no data collection.
I can't believe I have to say that. 
Long live the handmade web.

## Attribution

Made by Muhammad Alfi.

Based on [delphitools](https://github.com/1612elphi/delphitools) by [delphi](https://github.com/1612elphi).

- Original source: [1612elphi/delphitools](https://github.com/1612elphi/delphitools)
- This fork source: [muhalpi/malpitools](https://github.com/muhalpi/malpitools)
- Fork maintainer: malpi

This fork preserves the original MIT License and copyright notice. Modifications are additionally noted in [LICENSE](./LICENSE).

### Original contributors

The following contributors are preserved from the original delphitools credits:

- [Himanshu Balani](https://github.com/himanshubalani)
- [Mahmoud Ashraf](https://github.com/SNO7E-G)
- [Moamal Alaa](https://github.com/Moamal-2000)
- [Mouaz Aldakkak](https://github.com/movoid12)
- [Pranav K](https://github.com/Pranavk-official)
- [Claude](https://rmv.fyi/notes/i-hope-you-don-t-use-generative-ai)

### Additional contributors

- malpi

## Included tools

### social media

- social media cropper
- matte genny
- seamless scroll genny
- watermarker

### colour

- colour converter (hex, rgb, hsl, oklch, lab, lch, oklab)
- tailwind shade genny
- harmony genny
- palette genny
- palette collection
- palette extractor
- pixel picker
- contrast checker
- colour blindness simulator
- gradient genny

### img & assets

- favicon genny
- svg optimiser
- placeholder genny
- image splitter
- image converter
- image clipper
- artwork enhancer
- background remover
- image tracer
- paste image

### typo & text

- px to rem
- line height calc
- typo calc (agates, ciceros, picas, pt, inches, mm)
- paper sizes
- word counter
- text diff
- glyph browser
- font file explorer
- text editor (distraction-free, live-preview markdown writer)
- document converter (pandoc in your browser — markdown ⇄ html, word, odt, epub, latex, rst & more)

### print & production

- pdf preflight
- zine imposer
- print imposer

### other tools

- text scratchpad
- tailwind cheat sheet
- qr genny
- barcode genny
- meta tag genny
- regex tester
- cipher decoder

### calculators

- scientific calc
- graph calc
- algebra calc
- base converter
- time calc
- unit converter
- encoding tools

### turbo-nerd shit

- shavian transliterator


## **Self-Host Guide with Docker**

- **Build locally:**  
```bash
docker build -t malpitools:latest .
# Optional: stamp the in-app version label (shown when hovering the logo).
# .git is not in the build context, so pass the SHA explicitly:
docker build --build-arg COMMIT_SHA=$(git rev-parse --short HEAD) -t malpitools:latest .
```

- **Run locally:**  
```bash
# serve on http://localhost:3000 
docker run --rm -p 3000:80 malpitools:latest
```

- **With docker-compose:**  
```bash
## to start the container
docker-compose up -d --build
## stamp the version label too (otherwise it shows "dev"):
COMMIT_SHA=$(git rev-parse --short HEAD) docker-compose up -d --build
## to stop the container
docker-compose down
```

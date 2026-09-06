FROM node:20-alpine
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev
COPY . .
RUN node --input-type=module -e "import fs from 'fs'; await fs.promises.mkdir('public/tessdata',{recursive:true}); const urls=['https://tessdata.projectnaptha.com/4.0.0/kor.traineddata.gz','https://cdn.jsdelivr.net/gh/naptha/tessdata@gh-pages/4.0.0/kor.traineddata.gz']; let last; for (const url of urls){ try { const r=await fetch(url); if(!r.ok) throw new Error(r.status); const b=Buffer.from(await r.arrayBuffer()); if(b.length<1000) throw new Error('small'); await fs.promises.writeFile('public/tessdata/kor.traineddata.gz', b); last=null; break; } catch(e){ last=e; } } if(last) throw last;"
ENV NODE_ENV=production
EXPOSE 3000
CMD ["node", "server.js"]

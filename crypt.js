#!/usr/bin/env node
const fs = require("fs");
const crypto = require("crypto");
const readline = require("readline");

const SOURCE = "decrypted.index.html";
const OUTPUT = "index.html";
const ITERATIONS = 600000;

function askHidden(prompt) {
  return new Promise((resolve) => {
    if (!process.stdin.isTTY) {
      const rl = readline.createInterface({input:process.stdin, output:process.stdout});
      rl.question(prompt, a => { rl.close(); resolve(a); });
      return;
    }
    process.stdout.write(prompt);
    let value = "";
    process.stdin.setRawMode(true);
    process.stdin.resume();
    process.stdin.setEncoding("utf8");
    const onData = ch => {
      if (ch === "\r" || ch === "\n") {
        process.stdin.setRawMode(false); process.stdin.pause();
        process.stdin.off("data", onData);
        process.stdout.write("\n"); resolve(value);
      } else if (ch === "\u0003") process.exit(130);
      else if (ch === "\u007f") {
        if (value.length) { value=value.slice(0,-1); process.stdout.write("\b \b"); }
      } else { value += ch; process.stdout.write("*"); }
    };
    process.stdin.on("data", onData);
  });
}

function b64(b){ return b.toString("base64"); }
function from64(s){ return Buffer.from(s,"base64"); }

function makeWrapper(salt, iv, ciphertext, tag) {
return `<!doctype html>
<html lang="de">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<meta name="robots" content="noindex,nofollow,noarchive">
<title>törtchen.love</title>
<style>
*{box-sizing:border-box}html,body{height:100%}body{margin:0;display:grid;place-items:center;padding:28px;background:#fff8ef;color:#241d1a;font-family:ui-rounded,"SF Pro Rounded","SF Pro Display",-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif}
main{width:min(440px,100%);text-align:center}.lock{font-size:54px;margin-bottom:14px}h1{font-size:34px;letter-spacing:-.04em;margin:0 0 8px}p{color:#776b65;margin:0 0 24px}form{display:flex;gap:9px}input{min-width:0;flex:1;border:1px solid #e8ddd3;background:#fffdf9;border-radius:14px;padding:15px 16px;font:inherit;font-size:16px;outline:none}button{border:0;border-radius:14px;padding:15px 18px;background:#241d1a;color:#fff;font:700 16px inherit;cursor:pointer}#error{min-height:1.5em;color:#b33b4c;margin-top:16px;font-size:14px}small{display:block;margin-top:25px;color:#a2948c}
</style></head><body><main>
<div class="lock">🔒</div><h1>Törtchen ist noch geheim.</h1><p>Passwort eingeben, um nachzusehen.</p>
<form id="unlock"><input id="pw" type="password" autocomplete="current-password" placeholder="Passwort" autofocus><button>Öffnen</button></form>
<div id="error" role="alert"></div><small>törtchen.love</small></main>
<script>
const SALT="${b64(salt)}", IV="${b64(iv)}", DATA="${b64(Buffer.concat([ciphertext,tag]))}", ITERATIONS=${ITERATIONS};
const bytes=s=>Uint8Array.from(atob(s),c=>c.charCodeAt(0));
async function decrypt(password){
 const material=await crypto.subtle.importKey("raw",new TextEncoder().encode(password),"PBKDF2",false,["deriveKey"]);
 const key=await crypto.subtle.deriveKey({name:"PBKDF2",salt:bytes(SALT),iterations:ITERATIONS,hash:"SHA-256"},material,{name:"AES-GCM",length:256},false,["decrypt"]);
 return new TextDecoder().decode(await crypto.subtle.decrypt({name:"AES-GCM",iv:bytes(IV)},key,bytes(DATA)));
}
document.querySelector("#unlock").addEventListener("submit",async e=>{
 e.preventDefault();const err=document.querySelector("#error");err.textContent="Entschlüssele …";
 try{const html=await decrypt(document.querySelector("#pw").value);document.open();document.write(html);document.close()}
 catch(_){err.textContent="Nope. Falsches Passwort. 🍼";document.querySelector("#pw").select()}
});
</script></body></html>`;
}

async function main(){
  const mode=process.argv[2];
  let password=process.argv[3] || process.env.TOERTCHEN_PASSWORD;
  if(!["encrypt","decrypt"].includes(mode)){
    console.error("Usage: node crypt.js encrypt [password]\\n       node crypt.js decrypt [password]");
    process.exit(2);
  }
  if(!password) password=await askHidden("Password: ");
  if(!password) throw new Error("Password must not be empty.");

  if(mode==="encrypt"){
    const plaintext=fs.readFileSync(SOURCE);
    const salt=crypto.randomBytes(16), iv=crypto.randomBytes(12);
    const key=crypto.pbkdf2Sync(password,salt,ITERATIONS,32,"sha256");
    const cipher=crypto.createCipheriv("aes-256-gcm",key,iv);
    const ciphertext=Buffer.concat([cipher.update(plaintext),cipher.final()]);
    const tag=cipher.getAuthTag();
    fs.writeFileSync(OUTPUT,makeWrapper(salt,iv,ciphertext,tag));
    console.log(`Encrypted ${SOURCE} -> ${OUTPUT}`);
  } else {
    const html=fs.readFileSync(OUTPUT,"utf8");
    const pick=name=>{
      const m=html.match(new RegExp(name+'="([^"]+)"'));
      if(!m) throw new Error("Could not find "+name+" in index.html");
      return from64(m[1]);
    };
    const salt=pick("SALT"), iv=pick("IV"), combined=pick("DATA");
    const tag=combined.subarray(combined.length-16), ciphertext=combined.subarray(0,combined.length-16);
    const key=crypto.pbkdf2Sync(password,salt,ITERATIONS,32,"sha256");
    const decipher=crypto.createDecipheriv("aes-256-gcm",key,iv);
    decipher.setAuthTag(tag);
    const plaintext=Buffer.concat([decipher.update(ciphertext),decipher.final()]);
    fs.writeFileSync(SOURCE,plaintext);
    console.log(`Decrypted ${OUTPUT} -> ${SOURCE}`);
  }
}
main().catch(e=>{console.error("Error:",e.message);process.exit(1)});

import { NextResponse } from "next/server";

// Serves the tiny web-tracking beacon. Drop this on the NuKava marketing site:
//   <script src="https://nukava.vercel.app/api/track/snippet" async></script>
// It auto-tracks page views and exposes window.nukava.track() / .identify().
export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(req: Request) {
  const origin = process.env.NEXT_PUBLIC_APP_URL || new URL(req.url).origin;
  const endpoint = `${origin.replace(/\/$/, "")}/api/track`;

  const js = `(function(){
  var ENDPOINT=${JSON.stringify(endpoint)};
  var KEY="nukava_vid";
  function vid(){try{var v=localStorage.getItem(KEY);if(!v){v=(window.crypto&&crypto.randomUUID)?crypto.randomUUID():(Date.now()+"-"+Math.random().toString(36).slice(2));localStorage.setItem(KEY,v);}return v;}catch(e){return null;}}
  function send(p){try{p.visitor_id=vid();var b=JSON.stringify(p);if(navigator.sendBeacon){navigator.sendBeacon(ENDPOINT,new Blob([b],{type:"application/json"}));}else{fetch(ENDPOINT,{method:"POST",headers:{"Content-Type":"application/json"},body:b,keepalive:true});}}catch(e){}}
  window.nukava={
    track:function(type,props){send({type:type||"page_view",source:"web",title:(props&&props.title)||document.title,url:location.href,properties:props||{}});},
    identify:function(traits){send({type:"form_submit",source:"form",title:"Submitted a form",url:location.href,identify:traits||{},properties:traits||{}});}
  };
  window.nukava.track("page_view",{title:document.title});
})();`;

  return new NextResponse(js, {
    status: 200,
    headers: {
      "Content-Type": "application/javascript; charset=utf-8",
      "Cache-Control": "public, max-age=300",
      "Access-Control-Allow-Origin": "*",
    },
  });
}

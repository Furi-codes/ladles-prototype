import React from 'react';
/** Local assets only; no Next.js image endpoint or remote image request. */
export default function Image({src,alt='',fill,...inputProps}){
  const props=Object.fromEntries(Object.entries(inputProps).filter(([key])=>!['priority','unoptimized','quality','placeholder','blurDataURL'].includes(key)));
  const url=typeof src==='string'?src:src?.src;
  const localFile=typeof window!=='undefined'&&window.location.protocol==='file:';
  return React.createElement('img',{...props,alt,src:localFile&&url?.startsWith('/')?'../public'+url:url,style:{...props.style,...(fill?{position:'absolute',width:'100%',height:'100%',objectFit:'cover'}:{})}});
}

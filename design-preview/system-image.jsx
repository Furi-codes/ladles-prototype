/* eslint-disable @next/next/no-img-element -- Offline copy deliberately does not call the Next.js image service. */
import React from 'react';
export default function Image({src,alt='',fill,...inputProps}){
  const props=Object.fromEntries(Object.entries(inputProps).filter(([key])=>!['priority','unoptimized','quality','placeholder','blurDataURL'].includes(key)));
  const url=typeof src==='string'?src:src?.src;
  return <img {...props} alt={alt} src={url?.startsWith('/')?'../public'+url:url} style={{...props.style,...(fill?{position:'absolute',width:'100%',height:'100%',objectFit:'cover'}:{})}}/>;
}

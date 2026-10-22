import React from 'react';
import {go} from './corporate-review-runtime';
export default function Link({href,children,onClick,...props}){return <a {...props} href={String(href).startsWith('/')?'#'+href:href} onClick={event=>{onClick?.(event);if(!event.defaultPrevented&&String(href).startsWith('/')){event.preventDefault();go(String(href));}}}>{children}</a>;}

import React from 'react';
import {go} from './system-runtime';
export default function Link({href,children,onClick,...props}){return <a {...props} href={'#'+href} onClick={event=>{onClick?.(event);if(!event.defaultPrevented){event.preventDefault();go(String(href));}}}>{children}</a>;}

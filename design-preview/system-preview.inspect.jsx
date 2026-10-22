/* Node-only render checks. Never loaded by system.html. */
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {ThemeProvider} from './system-source/app/components/ThemeProvider';
import {CurrentScreen} from './system-preview';
import {go,routes,action,data,resetPreview} from './system-runtime';
export function renderScreen(path){go(path);return renderToStaticMarkup(<ThemeProvider><CurrentScreen/></ThemeProvider>);}
export {routes,action,resetPreview};
export {supabase} from './system-runtime';
export const getData=()=>data;

"use client";

/**
 * Keeps keyboard focus inside an open dialog and restores focus afterwards.
 * Escape and Tab handling belong to the overlay lifecycle rather than each individual form.
 */

import { useEffect, useRef } from 'react';

/** Keep keyboard focus inside an open confirmation, then return it to the trigger. */
export function useDialogFocus(open: boolean, panel: React.RefObject<HTMLElement | null>, onCancel: () => void, busy = false) {
  const cancel=useRef(onCancel), locked=useRef(busy);
  useEffect(()=>{cancel.current=onCancel;locked.current=busy;},[onCancel,busy]);
  useEffect(()=>{
    const element=panel.current;
    if(!open || !element) return;
    const previous=document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const controls=()=>Array.from(element.querySelectorAll<HTMLElement>('button:not([disabled]),a[href],input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex="0"]')).filter(node=>node.getClientRects().length>0);
    (controls()[0] || element).focus({preventScroll:true});
    const keydown=(event:KeyboardEvent)=>{
      if(event.key==='Escape'){event.preventDefault();if(!locked.current)cancel.current();return;}
      if(event.key!=='Tab')return;
      const items=controls(), first=items[0], last=items.at(-1);
      if(!first || !last){event.preventDefault();element.focus();return;}
      if(event.shiftKey && (document.activeElement===first || !element.contains(document.activeElement))){event.preventDefault();last.focus();}
      else if(!event.shiftKey && (document.activeElement===last || !element.contains(document.activeElement))){event.preventDefault();first.focus();}
    };
    document.addEventListener('keydown',keydown);
    return ()=>{document.removeEventListener('keydown',keydown);if(previous?.isConnected && previous.getClientRects().length)previous.focus({preventScroll:true});};
  },[open,panel]);
}

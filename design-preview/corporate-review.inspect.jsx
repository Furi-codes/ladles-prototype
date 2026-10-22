/* Node-only test entry. */
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {ThemeProvider} from '../app/components/ThemeProvider';
import {ReviewScreen} from './corporate-review';
import {go,reviewAs} from './corporate-review-runtime';
import {OutcomeTable} from '../app/corporate/components/CorporateOutcomeReports';
import {CorporateAttendanceForm} from '../app/corporate/components/CorporateAttendance';
export * from './corporate-review-runtime';
export function renderScreen(route){if(route.startsWith('/admin'))reviewAs('admin');else if(route.startsWith('/corporate')&&!route.endsWith('/register'))reviewAs('corporate');else reviewAs(null);go(route);return renderToStaticMarkup(<ThemeProvider><ReviewScreen/></ThemeProvider>);}
export function renderOutcomeTable(rows){return renderToStaticMarkup(<OutcomeTable rows={rows}/>);}
export function renderAttendanceForm(booking){return renderToStaticMarkup(<CorporateAttendanceForm booking={booking} dirtyChanged={()=>{}} committed={async()=>{}}/>);}
export {loadAllCorporateOutcomeRows} from '../lib/actions/corporate-outcomes';
export {corporateOutcomesCsv,cleanCorporateAttendance,summariseCorporateOutcomes} from '../lib/corporate-outcomes';

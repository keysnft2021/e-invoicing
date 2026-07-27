import { Outlet } from "react-router-dom";

/** ICS pages now navigate via the main app sidebar (expandable ICS Console group).
 *  This layout is intentionally minimal — just renders the active child page.
 */
export default function IcsLayout() {
    return <Outlet />;
}

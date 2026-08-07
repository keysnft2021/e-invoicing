import { Outlet } from "react-router-dom";

/** EIW pages now navigate via the main app sidebar (expandable EIS Console group).
 *  This layout is intentionally minimal — just renders the active child page.
 */
export default function IcsLayout() {
    return <Outlet />;
}

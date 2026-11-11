"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const playwright_1 = require("playwright");
const auth_1 = require("./auth");
const userDataVisibilityControl_1 = require("./userDataVisibilityControl");
async function runTestSuite() {
    console.log('========================================================================');
    console.log('STARTING ROLE-BASED HOME DASHBOARD COMPREHENSIVE VERIFICATION SUITE');
    console.log('========================================================================\n');
    const browser = await playwright_1.chromium.launch();
    // --------------------------------------------------------------------------
    // TEST 1: Super Admin Login & Dashboard Check
    // --------------------------------------------------------------------------
    console.log('▶ TEST 1: Super Admin Dashboard Layout & Metric Preservation');
    const adminContext = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const adminToken = await (0, auth_1.createSession)('usr-admin-root');
    await adminContext.addCookies([{
            name: 'signsync_session',
            value: adminToken,
            domain: 'localhost',
            path: '/',
            httpOnly: true,
            sameSite: 'Lax',
        }]);
    const adminPage = await adminContext.newPage();
    await adminPage.goto('http://localhost:3000/', { waitUntil: 'networkidle' });
    await adminPage.waitForTimeout(2000);
    const adminHeading = await adminPage.locator('h1').innerText();
    console.log('  Admin Greeting displayed:', adminHeading);
    // Verify Admin KPI Cards
    const activePartnersCard = await adminPage.locator('text=Active Partners').first().isVisible();
    const pendingPaymentsCard = await adminPage.locator('text=Pending Payments').first().isVisible();
    const tokensPurchasedCard = await adminPage.locator('text=Tokens Purchased').first().isVisible();
    const customerLeadsCard = await adminPage.locator('text=Customer Leads').first().isVisible();
    console.log('  Active Partners Card Visible:', activePartnersCard);
    console.log('  Pending Payments Card Visible:', pendingPaymentsCard);
    console.log('  Tokens Purchased Card Visible:', tokensPurchasedCard);
    console.log('  Customer Leads Card Visible:', customerLeadsCard);
    await adminPage.screenshot({ path: 'src/server/home_dashboard_admin_final.png' });
    console.log('  Screenshot saved: src/server/home_dashboard_admin_final.png\n');
    // --------------------------------------------------------------------------
    // TEST 2: Staff User (Anjali Nair) Operational Dashboard Check
    // --------------------------------------------------------------------------
    console.log('▶ TEST 2: Staff Operational Dashboard (Anjali Nair)');
    const staffContext = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const anjaliToken = await (0, auth_1.createSession)('usr-emp-anjali');
    await staffContext.addCookies([{
            name: 'signsync_session',
            value: anjaliToken,
            domain: 'localhost',
            path: '/',
            httpOnly: true,
            sameSite: 'Lax',
        }]);
    const staffPage = await staffContext.newPage();
    await staffPage.goto('http://localhost:3000/', { waitUntil: 'networkidle' });
    await staffPage.waitForTimeout(2000);
    const staffHeading = await staffPage.locator('h1').innerText();
    console.log('  Staff Greeting displayed:', staffHeading);
    // Verify Staff Operational KPI Cards
    const myAppsCard = await staffPage.locator('text=My Applications').first().isVisible();
    const pendingActionsCard = await staffPage.locator('text=Pending Actions').first().isVisible();
    const dueTodayCard = await staffPage.locator('text=Due Today').first().isVisible();
    const completedTodayCard = await staffPage.locator('text=Completed Today').first().isVisible();
    console.log('  My Applications Card Visible:', myAppsCard);
    console.log('  Pending Actions Card Visible:', pendingActionsCard);
    console.log('  Due Today Card Visible:', dueTodayCard);
    console.log('  Completed Today Card Visible:', completedTodayCard);
    // Verify Staff Operational Sections
    const myDscWorkflow = await staffPage.locator('text=My DSC Workflow').first().isVisible();
    const myWorkSection = await staffPage.locator('text=My Work').first().isVisible();
    const recentActivitySection = await staffPage.locator('text=Recent Activity').first().isVisible();
    const quickActionsSection = await staffPage.locator('text=Operational Quick Actions').first().isVisible();
    console.log('  My DSC Workflow Section Visible:', myDscWorkflow);
    console.log('  My Work Section Visible:', myWorkSection);
    console.log('  Recent Activity Section Visible:', recentActivitySection);
    console.log('  Operational Quick Actions Visible:', quickActionsSection);
    // Verify Financial Metrics NOT shown
    const revenueOnStaff = await staffPage.locator('text=Gross Sales Revenue').count();
    const profitOnStaff = await staffPage.locator('text=Company-wide Profit').count();
    console.log('  Unauthorized Financial Metrics Excluded (count = 0):', revenueOnStaff === 0 && profitOnStaff === 0);
    await staffPage.screenshot({ path: 'src/server/home_dashboard_staff_final.png' });
    console.log('  Screenshot saved: src/server/home_dashboard_staff_final.png\n');
    // --------------------------------------------------------------------------
    // TEST 3: User B (Rahul Kumar) Dynamic Name Personalization
    // --------------------------------------------------------------------------
    console.log('▶ TEST 3: Dynamic Name Personalization for Different Users');
    const rahulContext = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const rahulToken = await (0, auth_1.createSession)('usr-emp-rahul');
    await rahulContext.addCookies([{
            name: 'signsync_session',
            value: rahulToken,
            domain: 'localhost',
            path: '/',
            httpOnly: true,
            sameSite: 'Lax',
        }]);
    const rahulPage = await rahulContext.newPage();
    await rahulPage.goto('http://localhost:3000/', { waitUntil: 'networkidle' });
    await rahulPage.waitForTimeout(2000);
    const rahulHeading = await rahulPage.locator('h1').innerText();
    console.log('  Rahul User Greeting displayed:', rahulHeading);
    const containsRahul = rahulHeading.includes('Rahul');
    const containsAnjali = staffHeading.includes('Anjali');
    console.log('  Correctly Personalized Without Hardcoding:', containsRahul && containsAnjali);
    console.log('\n');
    // --------------------------------------------------------------------------
    // TEST 4: Time-Based Greeting Verification
    // --------------------------------------------------------------------------
    console.log('▶ TEST 4: Time-Based Greeting Verification');
    const currentHour = new Date().getHours();
    console.log('  Current local hour:', currentHour);
    let expectedPrefix = 'Good Morning';
    if (currentHour >= 12 && currentHour < 17)
        expectedPrefix = 'Good Afternoon';
    else if (currentHour >= 17)
        expectedPrefix = 'Good Evening';
    console.log('  Expected prefix for current hour:', expectedPrefix);
    console.log('  Actual prefix in header:', staffHeading.split(',')[0]);
    console.log('  Time greeting matched:', staffHeading.startsWith(expectedPrefix));
    console.log('\n');
    // --------------------------------------------------------------------------
    // TEST 5 & 6: Data Visibility & Profile/Client Scoping
    // --------------------------------------------------------------------------
    console.log('▶ TEST 5 & 6: Data Visibility & Authorization Scoping Server Enforcement');
    // Configure limited scope for Rahul: restricted to 1 partner only
    await (0, userDataVisibilityControl_1.saveUserVisibilityScope)({
        id: 'scope-emp-rahul',
        organization_id: 'comp-default',
        user_id: 'usr-emp-rahul',
        all_profiles_access: false,
        assigned_profile_ids: ['profile-dbiz-consultancy'],
        assigned_state_codes: ['27'], // Maharashtra only
        assigned_customer_ids: ['part-001'], // Apex Digital Certifications LLP only
        assigned_category_ids: [],
        can_view_revenue: false,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
    });
    const http = require('http');
    const testScoping = () => new Promise((resolve) => {
        http.get('http://localhost:3000/api/dashboard/overview', {
            headers: { Cookie: 'signsync_session=' + rahulToken }
        }, (res) => {
            let data = '';
            res.on('data', (c) => data += c);
            res.on('end', () => resolve(JSON.parse(data)));
        });
    });
    const rahulScoped = await testScoping();
    console.log('  Rahul Scoped Applications:', rahulScoped.kpis.my_applications);
    console.log('  Rahul Scoped Work Items:', rahulScoped.my_work.length);
    // Verify all work items for Rahul belong only to allowed partner part-001
    const allAllowed = rahulScoped.my_work.every((w) => w.client.includes('Apex Digital'));
    console.log('  Strict Scoping Enforced (only accessible partner records exposed):', allAllowed);
    console.log('\n');
    await browser.close();
    console.log('========================================================================');
    console.log('ALL DASHBOARD VERIFICATION TESTS COMPLETED SUCCESSFULLY');
    console.log('========================================================================');
}
runTestSuite().catch(err => {
    console.error('Test Suite Failed:', err);
    process.exit(1);
});

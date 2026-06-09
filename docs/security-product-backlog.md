# Security and Product Backlog

This backlog captures banking workflow decisions that should stay visible after the urgent security patch work.

## Agency Ownership and Support

- Every customer KYC session should be tied to an agency before submission or review.
- Customers should be able to see which agency their account is tied to.
- Agency changes should be requestable through support with proof of new residence or another bank-approved justification.
- JEAN agents should access dossiers and support attachments for their agency, not only dossiers personally assigned to them.
- Assignment should remain a workload/routing signal, not a single-agent bottleneck.

## CRM and Product Retention

- Add CRM-style customer service interactions inside the platform so branch agents can promote BICEC products and services during onboarding and support.
- Keep the API granular enough to later expose product/service catalog capabilities for internal apps or controlled B2B integrations.
- Record customer-service actions and high-criticality account actions in audit logs for later DBA, SCO, and policy review.

## In-Branch Assisted Digital Onboarding

- Support a printed branch QR code that opens the PWA onboarding flow.
- Allow branch assistants or interns to guide customers through the PWA while the customer keeps control of their phone and consent.
- Let branch agents continue review from the submitted digital dossier to reduce queues and improve capture accuracy.

## Mobile Authentication Evolution

- Add a password-backed mobile account option in addition to phone/email and PIN.
- Keep the PIN as the convenient day-to-day device unlock factor for PWA-compatible devices.
- Use password plus OTP or another step-up factor for high-risk events such as new device registration, PIN reset, agency change, and regulatory unblock requests.

## Admin Configurability and Audit

- Security-sensitive settings should be configurable by authorized admins only when the environment and policy allow it.
- All admin changes to security settings, agent availability, role, agency assignment, password resets, and similar controls must create durable audit records.
- The back-office should visibly identify development/test mode for admin and manager roles so nobody mistakes demo guardrails for production policy.

## Regulatory Block Controls

- Soft-deleted, blocked, frozen, or regulatory-risk users should remain blocked across login, refresh, device registration, support, and downstream service calls.
- Add review screens and reporting for blocked users because regulatory mistakes can create very high financial exposure.

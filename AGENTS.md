# Delivery

- Deploy completed user-requested changes by default after the appropriate
  checks pass. The owner explicitly requested this standing preference on
  9 September 2026; a local preview alone does not complete delivery.
- Before each deployment, fetch and integrate the latest remote `main`.
  Preserve concurrent work and never force-push the shared branch.
- Verify the GitHub Pages deployment succeeds and check a fresh public page
  before reporting completion.

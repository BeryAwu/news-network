# Test approach

`core.test.ts` exercises structured output rejection, URL-safe slug boundaries, hostname normalization, public-IP classifications, and explicit test-adapter provenance. Runtime/database integration checks require a configured PostgreSQL service and Cloudinary credentials; these are not treated as passing with mocks. Use `npm run db:migrate -- --name initial`, configure the real service credentials, and exercise `/briefs`, `/editorial`, `/assets`, and `/publishing` end to end before production.

// Load jest-dom matchers when the dependency is available in the environment.
try {
    require("@testing-library/jest-dom");
} catch (error) {
    // The project does not currently install jest-dom in every environment.
}

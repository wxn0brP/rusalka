import * as core from "@actions/core";
import * as exec from "@actions/exec";
import * as github from "@actions/github";
import fs from "fs";
import path from "path";

try {
    // --- INPUTS ---
    let files = (core.getInput("files") || "dist package.json LICENSE").split(" ");
    const branch = core.getInput("branch") || "dist";
    const preBuildCommands = core.getInput("preBuildCustomCommands");
    const postBuildCommands = core.getInput("customCommands");
    const scriptsHandling = core.getInput("scriptsHandling") || "keep-start";
    const customScripts = core.getInput("customScripts");
    const publishToNpm = core.getInput("publishToNpm") === "true";
    const createVersionedBranch = core.getInput("createVersionedBranch") === "true";

    core.startGroup("💜 Inputs");

    core.info(`Deploying to branch: ${branch}`);
    core.info(`Files: ${files.join(", ")}`);
    core.endGroup();

    // --- SETUP ---
    core.info("Setting up git");
    await exec.exec("git", ["config", "--global", "user.name", "github-actions[bot]"]);
    await exec.exec("git", ["config", "--global", "user.email", "github-actions[bot]@users.noreply.github.com"]);
    core.endGroup();

    // --- PRE BUILD COMMANDS ---
    if (preBuildCommands) {
        core.startGroup("💜 Pre-build commands");
        core.info(`Running pre-build commands: ${preBuildCommands}`);
        await exec.exec("bash", ["-c", preBuildCommands]);
        core.endGroup();
    }

    // --- BUILD ---
    core.startGroup("💜 Build");
    core.info("Installing dependencies");
    await exec.exec("bun", ["install"]);
    core.info("Building project");
    await exec.exec("bun", ["run", "build"]);
    core.endGroup();

    // --- POST BUILD COMMANDS ---
    if (postBuildCommands) {
        core.startGroup("💜 Post-build commands");
        core.info(`Running post-build commands: ${postBuildCommands}`);
        await exec.exec("bash", ["-c", postBuildCommands]);
        core.endGroup();
    }

    // --- MODIFY package.json ---
    if (scriptsHandling !== "retain-all") {
        core.info("Modifying package.json scripts");
        const pkgPath = path.join(process.cwd(), "package.json");
        const pkgJson = JSON.parse(fs.readFileSync(pkgPath, "utf8"));

        if (scriptsHandling === "remove-all") {
            delete pkgJson.scripts;
        } else if (scriptsHandling === "keep-start") {
            pkgJson.scripts = pkgJson.scripts?.start ? { start: pkgJson.scripts.start } : {};
        } else if (scriptsHandling === "keep-build") {
            pkgJson.scripts = pkgJson.scripts?.build ? { start: pkgJson.scripts.build } : {};
        } else if (scriptsHandling === "custom-list" && customScripts) {
            const keep = customScripts.split(",").map(s => s.trim());
            pkgJson.scripts = Object.fromEntries(
                Object.entries(pkgJson.scripts || {}).filter(([k]) => keep.includes(k))
            );
        }

        fs.writeFileSync(pkgPath, JSON.stringify(pkgJson, null, 2));
        core.info("Modified package.json scripts");
        core.endGroup();
    }

    // --- DEPLOY TO BRANCH ---
    core.startGroup("💜 Deploy to branch");
    core.info(`Checking out orphan branch: ${branch}`);
    await exec.exec("git", ["checkout", "--orphan", branch]);
    await exec.exec("git", ["reset", "-q", "HEAD", "--"]);

    for (const file of files) {
        if (fs.existsSync(file)) {
            await exec.exec("git", ["add", "-f", file]);
        } else {
            core.warning(`File does not exist: ${file}`);
        }
    }

    await exec.exec("git", ["commit", "-m", `Deploy to ${branch}`]);
    await exec.exec("git", ["push", "origin", branch, "--force"]);
    core.endGroup();

    // --- VERSIONED BRANCH ---
    const ref = github.context.ref; // eg refs/tags/v1.0.0
    if (createVersionedBranch && ref.startsWith("refs/tags/")) {
        core.startGroup("💜 Create versioned branch");
        const tagName = ref.replace("refs/tags/", "");
        const versionedBranch = `${branch}-${tagName}`;
        core.info(`Creating versioned branch: ${versionedBranch}`);
        await exec.exec("git", ["checkout", "-b", versionedBranch]);
        await exec.exec("git", ["push", "origin", versionedBranch, "--force"]);
        core.endGroup();
    }

    // --- PUBLISH TO NPM (OIDC) ---
    if (publishToNpm && ref.startsWith("refs/tags/")) {
        core.startGroup("💜 Publish to npm");
        core.info("Publishing to npm...");
        process.env.NPM_CONFIG_PROVENANCE = "true";
        const pkgVersion = JSON.parse(fs.readFileSync("package.json", "utf8")).version;
        let tag = "latest";

        if (pkgVersion.includes("alpha")) tag = "alpha";
        else if (pkgVersion.includes("beta")) tag = "beta";
        else if (pkgVersion.includes("rc")) tag = "next";

        core.info(`Publishing version ${pkgVersion} with tag ${tag}`);
        await exec.exec("npm", ["publish", "--access", "public", "--tag", tag]);
        core.endGroup();
    }

} catch (error: unknown) {
    if (error instanceof Error) core.setFailed(error.message);
}
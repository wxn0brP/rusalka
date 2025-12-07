import * as core from "@actions/core";
import * as exec from "@actions/exec";
import * as github from "@actions/github";
import fs from "fs";
import path from "path";

interface Config {
    files: string[];
    branch: string;
    preBuildCommands: string;
    postBuildCommands: string;
    preBuildFn: Function;
    postBuildFn: Function;
    scriptsHandling: string;
    customScripts: string[];
    publishToNpm: boolean;
    createVersionedBranch: boolean;
    typeDocs: number;
    publishBranch: string;
    destDir: string;
    notDeleteTests: boolean;
}

try {
    // --- INPUTS ---
    core.startGroup("💜 Inputs");
    const config: Config = {
        files: ["dist", "package.json", "LICENSE"],
        branch: "dist",
        preBuildCommands: "",
        postBuildCommands: "",
        preBuildFn: undefined,
        postBuildFn: undefined,
        scriptsHandling: "remove-all",
        customScripts: [],
        publishToNpm: false,
        createVersionedBranch: true,
        typeDocs: 1,
        publishBranch: "gh-pages",
        destDir: "",
        notDeleteTests: false,
    }

    const workflowName = github.context.workflow.toLowerCase().replace(/\s+/g, "_");
    const basePath = path.resolve(process.env.GITHUB_WORKSPACE || process.cwd(), "rusalka");
    const configExt = ["ts", "json"].find(ext => fs.existsSync(path.join(basePath, `${workflowName}.${ext}`)));
    if (configExt) {
        const configFile = path.join(basePath, `${workflowName}.${configExt}`);
        switch (configExt) {
            case "ts":
            case "js":
                const tsConfig = await import(path.resolve(configFile));
                Object.assign(config, tsConfig.default || tsConfig);
                break;
            case "json":
                const jsonConfig = JSON.parse(fs.readFileSync(configFile, "utf-8"));
                Object.assign(config, jsonConfig);
                break;
            default:
                break;
        }
    }

    core.info(`Config: ${JSON.stringify(config, null, 2)}`);
    core.endGroup();

    // --- SETUP ---
    core.info("Setting up git");
    await exec.exec("git", ["config", "--global", "user.name", "github-actions[bot]"]);
    await exec.exec("git", ["config", "--global", "user.email", "github-actions[bot]@users.noreply.github.com"]);
    core.endGroup();

    // --- PRE BUILD COMMANDS ---
    if (config.preBuildCommands) {
        core.startGroup("💜 Pre-build commands");
        core.info(`Running pre-build commands: ${config.preBuildCommands}`);
        await exec.exec("bash", ["-c", config.preBuildCommands]);
        core.endGroup();
    }

    // --- PRE BUILD FUNCTION ---
    if (config.preBuildFn) {
        core.startGroup("💜 Pre-build function");
        core.info("Running pre-build function");
        await config.preBuildFn();
        core.endGroup();
    }

    // --- DELETE TESTS ---
    if (!config.notDeleteTests && fs.existsSync("src/test")) {
        core.startGroup("💜 Delete tests");
        core.info("Deleting tests");
        await exec.exec("rm", ["-rf", "test"]);
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
    if (config.postBuildCommands) {
        core.startGroup("💜 Post-build commands");
        core.info(`Running post-build commands: ${config.postBuildCommands}`);
        await exec.exec("bash", ["-c", config.postBuildCommands]);
        core.endGroup();
    }

    // --- POST BUILD FUNCTION ---
    if (config.postBuildFn) {
        core.startGroup("💜 Post-build function");
        core.info("Running post-build function");
        await config.postBuildFn();
        core.endGroup();
    }

    // --- MODIFY package.json ---
    if (config.scriptsHandling !== "retain-all") {
        core.info("Modifying package.json scripts");
        const pkgPath = path.join(process.cwd(), "package.json");
        const pkgJson = JSON.parse(fs.readFileSync(pkgPath, "utf8"));

        if (config.scriptsHandling === "remove-all") {
            delete pkgJson.scripts;
        } else if (config.scriptsHandling === "keep-start") {
            pkgJson.scripts = pkgJson.scripts?.start ? { start: pkgJson.scripts.start } : {};
        } else if (config.scriptsHandling === "keep-build") {
            pkgJson.scripts = pkgJson.scripts?.build ? { start: pkgJson.scripts.build } : {};
        } else if (config.scriptsHandling === "custom-list" && config.customScripts) {
            const keep = config.customScripts;
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
    core.info(`Checking out orphan branch: ${config.branch}`);
    await exec.exec("git", ["checkout", "--orphan", config.branch]);
    await exec.exec("git", ["reset", "-q", "HEAD", "--"]);

    for (const file of config.files) {
        if (fs.existsSync(file)) {
            await exec.exec("git", ["add", "-f", file]);
        } else {
            core.warning(`File does not exist: ${file}`);
        }
    }

    await exec.exec("git", ["commit", "-m", `Deploy to ${config.branch}`]);
    await exec.exec("git", ["push", "origin", config.branch, "--force"]);
    core.endGroup();

    // --- VERSIONED BRANCH ---
    const ref = github.context.ref; // eg refs/tags/v1.0.0
    core.info(`Current ref: ${ref}`);
    if (config.createVersionedBranch && ref.startsWith("refs/tags/")) {
        core.startGroup("💜 Create versioned branch");
        const tagName = ref.replace("refs/tags/", "");
        const versionedBranch = `${config.branch}-${tagName}`;
        core.info(`Creating versioned branch: ${versionedBranch}`);
        await exec.exec("git", ["checkout", "-b", versionedBranch]);
        await exec.exec("git", ["push", "origin", versionedBranch, "--force"]);
        core.endGroup();
    }

    // --- PUBLISH TO NPM (OIDC) ---
    if (config.publishToNpm && ref.startsWith("refs/tags/")) {
        core.startGroup("💜 Publish to npm");
        core.info("Publishing to npm...");
        process.env.NPM_CONFIG_PROVENANCE = "true";
        const pkgVersion = JSON.parse(fs.readFileSync("package.json", "utf8")).version;
        let tag = "latest";

        if (pkgVersion.includes("alpha")) tag = "alpha";
        else if (pkgVersion.includes("beta")) tag = "beta";
        else if (pkgVersion.includes("rc")) tag = "next";

        core.info(`Detected tag: ${tag}`);
        core.setOutput("npm_tag", tag);
        core.endGroup();
    }

    const typedocs =
        config.typeDocs === 2 ||
        (config.typeDocs === 1 && config.publishToNpm);

    if (typedocs) {
        core.startGroup("💜 Typedocs");
        core.info("Generating typedocs");
        await exec.exec("bunx", ["typedoc", "--out", "typedocs-generated"]);
        core.setOutput("typedocs", config.publishBranch);
        core.setOutput("destination_dir", config.destDir);
        await exec.exec("curl", [
            "-o",
            "typedocs-generated/404.html",
            "https://raw.githubusercontent.com/wxn0brP/wxn0brp.github.io/refs/heads/master/public/404.html"
        ]);

        core.endGroup();
    }

} catch (error: unknown) {
    if (error instanceof Error) core.setFailed(error.message);
}
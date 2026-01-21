#!/usr/bin/env node
/**
 * Project Axiom: SCORM Package Generator
 * Creates a SCORM 1.2 or 2004 compliant package from the dist folder.
 * 
 * IMPORTANT: Run `npm run build` first to generate the dist folder.
 * 
 * Usage: node tools/create-scorm-package.js [--version 1.2|2004]
 */

import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';

// Parse CLI arguments
const args = process.argv.slice(2);
const scormVersion = args.includes('--version') 
  ? args[args.indexOf('--version') + 1] 
  : '2004';

// Source is always dist folder (minified build)
const distDir = 'dist';

// Verify dist folder exists
if (!fs.existsSync(distDir)) {
  console.error('❌ Error: dist/ folder not found.');
  console.error('   Run `npm run build` first to generate the production build.');
  process.exit(1);
}

// Load course data
const courseDataPath = './data/scobot.json';
let courseData = {};

try {
  courseData = JSON.parse(fs.readFileSync(courseDataPath, 'utf-8'));
} catch (e) {
  console.error('Error: Could not load data/scobot.json');
  console.error('Make sure you have a valid scobot.json file in the data/ directory.');
  process.exit(1);
}

const meta = courseData.meta || {};
const identifier = (meta.title || 'course').toLowerCase().replace(/[^a-z0-9]/g, '_');
const version = meta.version || '1.0.0';
const title = meta.title || 'Untitled Course';
const description = meta.description || '';

console.log(`\n📦 SCORM ${scormVersion} Package Generator`);
console.log(`   Course: ${title}`);
console.log(`   Version: ${version}\n`);

// Create output directory for SCORM package
const outputDir = 'scorm-packages';
const packageDir = path.join(outputDir, `${identifier}_scorm${scormVersion}`);

// Clean and create package directory
if (fs.existsSync(packageDir)) {
  fs.rmSync(packageDir, { recursive: true, force: true });
}
fs.mkdirSync(packageDir, { recursive: true });

// Copy entire dist folder contents to package
console.log('📁 Copying dist/ contents...');
copyDir(distDir, packageDir);
console.log('   ✓ All dist files copied');

// Generate imsmanifest.xml
console.log('\n📄 Generating imsmanifest.xml...');

const manifest = scormVersion === '1.2' 
  ? generateManifest12(identifier, title, description, version)
  : generateManifest2004(identifier, title, description, version);

fs.writeFileSync(path.join(packageDir, 'imsmanifest.xml'), manifest);
console.log('   ✓ imsmanifest.xml');

// Generate metadata files for SCORM 2004
if (scormVersion === '2004') {
  const metadata = generateMetadata2004(identifier, title, description);
  fs.writeFileSync(path.join(packageDir, 'metadata.xml'), metadata);
  console.log('   ✓ metadata.xml');
}

// Create ZIP package
console.log('\n🗜️  Creating ZIP package...');
const zipName = `${identifier}_v${version}_scorm${scormVersion}.zip`;
const zipPath = path.join(outputDir, zipName);

try {
  // Remove old zip if exists
  if (fs.existsSync(zipPath)) {
    fs.unlinkSync(zipPath);
  }
  
  // Use system zip command
  execSync(`cd "${packageDir}" && zip -r "../${zipName}" .`, { stdio: 'pipe' });
  console.log(`   ✓ ${zipPath}`);
} catch (e) {
  console.error('   ⚠ ZIP creation failed. Please zip the folder manually.');
  console.error(`   Folder: ${packageDir}`);
}

console.log('\n✅ SCORM package created successfully!');
console.log(`   📂 Folder: ${packageDir}`);
console.log(`   📦 Package: ${zipPath}\n`);

// === Helper Functions ===

function copyDir(src, dest) {
  fs.mkdirSync(dest, { recursive: true });
  const entries = fs.readdirSync(src, { withFileTypes: true });
  
  for (const entry of entries) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);
    
    // Skip .DS_Store and other hidden files
    if (entry.name.startsWith('.')) {
      continue;
    }
    
    if (entry.isDirectory()) {
      copyDir(srcPath, destPath);
    } else {
      fs.copyFileSync(srcPath, destPath);
    }
  }
}

function generateManifest12(identifier, title, description, version) {
  return `<?xml version="1.0" encoding="UTF-8"?>
<manifest identifier="${identifier}" version="${version}"
  xmlns="http://www.imsproject.org/xsd/imscp_rootv1p1p2"
  xmlns:adlcp="http://www.adlnet.org/xsd/adlcp_rootv1p2"
  xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
  xsi:schemaLocation="http://www.imsproject.org/xsd/imscp_rootv1p1p2 imscp_rootv1p1p2.xsd
    http://www.imsglobal.org/xsd/imsmd_rootv1p2p1 imsmd_rootv1p2p1.xsd
    http://www.adlnet.org/xsd/adlcp_rootv1p2 adlcp_rootv1p2.xsd">

  <metadata>
    <schema>ADL SCORM</schema>
    <schemaversion>1.2</schemaversion>
  </metadata>

  <organizations default="org_${identifier}">
    <organization identifier="org_${identifier}">
      <title>${escapeXml(title)}</title>
      <item identifier="item_${identifier}" identifierref="res_${identifier}">
        <title>${escapeXml(title)}</title>
        <adlcp:masteryscore>80</adlcp:masteryscore>
      </item>
    </organization>
  </organizations>

  <resources>
    <resource identifier="res_${identifier}" type="webcontent" adlcp:scormtype="sco" href="index.html">
      <file href="index.html"/>
      <file href="data/scobot.json"/>
      <dependency identifierref="dep_common"/>
    </resource>
    <resource identifier="dep_common" type="webcontent" adlcp:scormtype="asset">
      <file href="src/app.js"/>
      <file href="src/core/state.js"/>
      <file href="src/core/router.js"/>
      <file href="src/core/course-state.js"/>
      <file href="src/features/player/player.js"/>
      <file href="node_modules/@cybercussion/scobot/dist/scobot.js"/>
    </resource>
  </resources>

</manifest>`;
}

function generateManifest2004(identifier, title, description, version) {
  return `<?xml version="1.0" encoding="UTF-8"?>
<manifest identifier="${identifier}" version="${version}"
  xmlns="http://www.imsglobal.org/xsd/imscp_v1p1"
  xmlns:adlcp="http://www.adlnet.org/xsd/adlcp_v1p3"
  xmlns:adlseq="http://www.adlnet.org/xsd/adlseq_v1p3"
  xmlns:adlnav="http://www.adlnet.org/xsd/adlnav_v1p3"
  xmlns:imsss="http://www.imsglobal.org/xsd/imsss"
  xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
  xsi:schemaLocation="http://www.imsglobal.org/xsd/imscp_v1p1 imscp_v1p1.xsd
    http://www.adlnet.org/xsd/adlcp_v1p3 adlcp_v1p3.xsd
    http://www.adlnet.org/xsd/adlseq_v1p3 adlseq_v1p3.xsd
    http://www.adlnet.org/xsd/adlnav_v1p3 adlnav_v1p3.xsd
    http://www.imsglobal.org/xsd/imsss imsss_v1p0.xsd">

  <metadata>
    <schema>ADL SCORM</schema>
    <schemaversion>2004 4th Edition</schemaversion>
    <adlcp:location>metadata.xml</adlcp:location>
  </metadata>

  <organizations default="org_${identifier}">
    <organization identifier="org_${identifier}" adlseq:objectivesGlobalToSystem="false">
      <title>${escapeXml(title)}</title>
      <item identifier="item_${identifier}" identifierref="res_${identifier}">
        <title>${escapeXml(title)}</title>
        <imsss:sequencing>
          <imsss:deliveryControls completionSetByContent="true" objectiveSetByContent="true"/>
        </imsss:sequencing>
      </item>
      <imsss:sequencing>
        <imsss:controlMode choice="true" flow="true"/>
      </imsss:sequencing>
    </organization>
  </organizations>

  <resources>
    <resource identifier="res_${identifier}" type="webcontent" adlcp:scormType="sco" href="index.html">
      <file href="index.html"/>
      <file href="data/scobot.json"/>
      <dependency identifierref="dep_common"/>
    </resource>
    <resource identifier="dep_common" type="webcontent" adlcp:scormType="asset">
      <file href="src/app.js"/>
      <file href="src/core/state.js"/>
      <file href="src/core/router.js"/>
      <file href="src/core/course-state.js"/>
      <file href="src/features/player/player.js"/>
      <file href="node_modules/@cybercussion/scobot/dist/scobot.js"/>
    </resource>
  </resources>

</manifest>`;
}

function generateMetadata2004(identifier, title, description) {
  return `<?xml version="1.0" encoding="UTF-8"?>
<lom xmlns="http://ltsc.ieee.org/xsd/LOM"
  xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
  xsi:schemaLocation="http://ltsc.ieee.org/xsd/LOM lom.xsd">

  <general>
    <identifier>
      <catalog>URI</catalog>
      <entry>${identifier}</entry>
    </identifier>
    <title>
      <string language="en">${escapeXml(title)}</string>
    </title>
    <language>en</language>
    <description>
      <string language="en">${escapeXml(description)}</string>
    </description>
  </general>

  <lifecycle>
    <version>
      <string language="en">1.0</string>
    </version>
    <status>
      <source>LOMv1.0</source>
      <value>final</value>
    </status>
  </lifecycle>

  <technical>
    <format>text/html</format>
    <location>index.html</location>
  </technical>

  <educational>
    <interactivityType>
      <source>LOMv1.0</source>
      <value>active</value>
    </interactivityType>
    <learningResourceType>
      <source>LOMv1.0</source>
      <value>exercise</value>
    </learningResourceType>
  </educational>

</lom>`;
}

function escapeXml(str) {
  return String(str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

/**
 * Comprehensive test script to verify all internal tools work correctly
 */

import { createToolRegistry } from '../dist/internal-tools/tool-registry.js';
import { promises as fs } from 'fs';
import { join } from 'path';

const testDir = './test-temp';

async function setupTestEnvironment() {
  // Create test directory and files
  await fs.mkdir(testDir, { recursive: true });
  
  // Create test files
  await fs.writeFile(join(testDir, 'test.js'), 'console.log("Hello, World!");');
  await fs.writeFile(join(testDir, 'package.json'), JSON.stringify({
    name: 'test-package',
    version: '1.0.0',
    scripts: { test: 'echo "test"' }
  }, null, 2));
  await fs.writeFile(join(testDir, 'README.md'), '# Test Package\n\nThis is a test package.');
  
  // Create subdirectory with files
  await fs.mkdir(join(testDir, 'src'), { recursive: true });
  await fs.writeFile(join(testDir, 'src', 'index.js'), 'export function test() { return "test"; }');
  
  console.log('✅ Test environment created');
}

async function cleanupTestEnvironment() {
  try {
    await fs.rm(testDir, { recursive: true, force: true });
    console.log('✅ Test environment cleaned up');
  } catch (error) {
    console.log('⚠️  Cleanup warning:', error.message);
  }
}

async function testReadFile(toolRegistry) {
  console.log('\n📖 Testing readFile...');
  
  const result = await toolRegistry.readFile({
    path: join(testDir, 'test.js')
  });
  
  if (result.success && result.content.includes('Hello, World!')) {
    console.log('✅ readFile: PASSED');
    return true;
  } else {
    console.log('❌ readFile: FAILED -', result.error);
    return false;
  }
}

async function testWriteFile(toolRegistry) {
  console.log('\n✍️  Testing writeFile...');
  
  const testPath = join(testDir, 'new-file.js');
  const testContent = 'console.log("New file created!");';
  
  const result = await toolRegistry.writeFile({
    path: testPath,
    content: testContent
  });
  
  if (result.success) {
    // Verify file was created
    const content = await fs.readFile(testPath, 'utf8');
    if (content === testContent) {
      console.log('✅ writeFile: PASSED');
      return true;
    }
  }
  
  console.log('❌ writeFile: FAILED -', result.error);
  return false;
}

async function testListFiles(toolRegistry) {
  console.log('\n📁 Testing listFiles...');
  
  const result = await toolRegistry.listFiles({
    path: testDir,
    recursive: true
  });
  
  if (result.success && result.files.length > 0) {
    const expectedFiles = ['test.js', 'package.json', 'README.md', 'src/'];
    const hasExpectedFiles = expectedFiles.some(file => 
      result.files.some(f => f.includes(file))
    );
    
    if (hasExpectedFiles) {
      console.log('✅ listFiles: PASSED');
      console.log('   Found files:', result.files.slice(0, 5));
      return true;
    }
  }
  
  console.log('❌ listFiles: FAILED -', result.error);
  return false;
}

async function testReadManyFiles(toolRegistry) {
  console.log('\n📚 Testing readManyFiles...');
  
  const result = await toolRegistry.readManyFiles({
    paths: [
      join(testDir, 'test.js'),
      join(testDir, 'package.json')
    ]
  });
  
  if (result.success && result.results.length === 2) {
    const successfulReads = result.results.filter(r => r.content && !r.error);
    if (successfulReads.length === 2) {
      console.log('✅ readManyFiles: PASSED');
      return true;
    }
  }
  
  console.log('❌ readManyFiles: FAILED -', result.error);
  return false;
}

async function testGlob(toolRegistry) {
  console.log('\n🔍 Testing glob...');
  
  const result = await toolRegistry.glob({
    pattern: '*.js',
    root: testDir
  });
  
  if (result.success && result.matches.length > 0) {
    if (result.matches.some(match => match.includes('test.js'))) {
      console.log('✅ glob: PASSED');
      console.log('   Found matches:', result.matches);
      return true;
    }
  }
  
  console.log('❌ glob: FAILED -', result.error);
  return false;
}

async function testGrep(toolRegistry) {
  console.log('\n🔎 Testing grep...');
  
  const result = await toolRegistry.grep({
    pattern: 'console.log',
    path: testDir,
    recursive: true
  });
  
  if (result.success && result.matches.length > 0) {
    console.log('✅ grep: PASSED');
    console.log('   Found matches:', result.matches.length);
    return true;
  }
  
  console.log('❌ grep: FAILED -', result.error);
  return false;
}

async function testExecuteShell(toolRegistry) {
  console.log('\n💻 Testing executeShell...');
  
  const result = await toolRegistry.executeShell({
    command: 'echo "test command"'
  });
  
  if (result.success && result.stdout.includes('test command')) {
    console.log('✅ executeShell: PASSED');
    return true;
  }
  
  console.log('❌ executeShell: FAILED -', result.error);
  return false;
}

async function testGitOperation(toolRegistry) {
  console.log('\n🌿 Testing gitOperation...');
  
  // Initialize git repo first
  await toolRegistry.executeShell({
    command: `cd ${testDir} && git init && git config user.email "test@example.com" && git config user.name "Test User"`
  });
  
  const result = await toolRegistry.gitOperation({
    operation: 'status',
    path: testDir
  });
  
  if (result.success) {
    console.log('✅ gitOperation: PASSED');
    return true;
  }
  
  console.log('❌ gitOperation: FAILED -', result.error);
  return false;
}

async function testWebSearch(toolRegistry) {
  console.log('\n🌐 Testing webSearch...');
  
  const result = await toolRegistry.webSearch({
    query: 'test query',
    numResults: 3
  });
  
  if (result.success && result.results.length > 0) {
    console.log('✅ webSearch: PASSED');
    console.log('   Results:', result.results.length);
    return true;
  }
  
  console.log('❌ webSearch: FAILED -', result.error);
  return false;
}

async function runAllTests() {
  console.log('🚀 Starting comprehensive tool tests...\n');
  
  try {
    await setupTestEnvironment();
    
    const toolRegistry = createToolRegistry();
    const tests = [
      testReadFile,
      testWriteFile,
      testListFiles,
      testReadManyFiles,
      testGlob,
      testGrep,
      testExecuteShell,
      testGitOperation,
      testWebSearch
    ];
    
    let passed = 0;
    let failed = 0;
    
    for (const test of tests) {
      try {
        const result = await test(toolRegistry);
        if (result) {
          passed++;
        } else {
          failed++;
        }
      } catch (error) {
        console.log(`❌ ${test.name}: FAILED - ${error.message}`);
        failed++;
      }
    }
    
    console.log('\n📊 Test Results:');
    console.log(`✅ Passed: ${passed}`);
    console.log(`❌ Failed: ${failed}`);
    console.log(`📈 Success Rate: ${((passed / (passed + failed)) * 100).toFixed(1)}%`);
    
    if (failed === 0) {
      console.log('\n🎉 All tests passed! Tools are working correctly.');
    } else {
      console.log('\n⚠️  Some tests failed. Please check the output above.');
    }
    
  } catch (error) {
    console.error('💥 Test suite failed:', error);
  } finally {
    await cleanupTestEnvironment();
  }
}

// Run tests if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  runAllTests();
}
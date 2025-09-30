// Comprehensive error taxonomy system for hierarchical error classification

export const ERROR_TAXONOMY: ErrorTaxonomy = {
  // Project Setup Errors
  PROJECT_SETUP: {
    MISSING_ENTRY_FILES: {
      description: 'Essential entry files missing from project',
      symptoms: ['Cannot find module', 'Entry point not found', 'File not found'],
      frameworkSpecific: {
        react: ['index.html', 'index.jsx', 'App.jsx'],
        vue: ['index.html', 'main.js', 'App.vue'],
        angular: ['index.html', 'main.ts', 'app.module.ts'],
        next: ['pages/index.js', 'app/page.tsx', 'layout.tsx']
      },
      commonCauses: ['Incomplete project setup', 'Incorrect file paths', 'Missing build configuration'],
      suggestedStrategies: ['defensive_programming', 'environment_isolation'],
      severity: 'high'
    },
    BUILD_CONFIG_ERROR: {
      description: 'Build tool configuration issues',
      symptoms: ['Build failed', 'Configuration error', 'Module resolution failed'],
      toolSpecific: {
        vite: ['vite.config.js issues', 'Plugin configuration', 'ES module support'],
        webpack: ['webpack.config.js issues', 'Loader configuration', 'Module rules'],
        parcel: ['package.json parcel config', 'Zero-config setup issues'],
        rollup: ['rollup.config.js issues', 'Plugin configuration', 'Output format']
      },
      commonCauses: ['Incorrect configuration syntax', 'Missing plugins', 'Path resolution issues'],
      suggestedStrategies: ['divide_and_conquer', 'environment_isolation'],
      severity: 'medium'
    },
    DEPENDENCY_ISSUES: {
      description: 'Package dependency conflicts or missing dependencies',
      symptoms: ['Module not found', 'Cannot resolve dependency', 'Version conflict'],
      dependencyTypes: {
        missing: ['Package not installed', 'Incorrect import path'],
        version_conflict: ['Incompatible versions', 'Peer dependency issues'],
        circular: ['Circular dependency detected', 'Dependency loop']
      },
      commonCauses: ['Incomplete package installation', 'Version incompatibilities', 'Circular imports'],
      suggestedStrategies: ['environment_isolation', 'pattern_matching'],
      severity: 'medium'
    }
  },

  // Runtime Errors
  RUNTIME_ERROR: {
    NULL_REFERENCE: {
      description: 'Accessing properties of null or undefined objects',
      symptoms: ['Cannot read property', 'null reference', 'undefined is not an object'],
      patterns: {
        direct_access: ['obj.property', 'obj.method()'],
        nested_access: ['obj.nested.property', 'obj.nested.method()'],
        array_access: ['arr[index].property', 'arr.find().property']
      },
      commonCauses: ['API response structure mismatch', 'Component lifecycle timing', 'Async operation timing'],
      suggestedStrategies: ['defensive_programming', 'data_flow_analysis', 'hypothesis_testing'],
      severity: 'high'
    },
    TYPE_ERROR: {
      description: 'Type mismatches and conversion errors',
      symptoms: ['Type error', 'Cannot convert', 'Invalid type', 'Not a function'],
      typeCategories: {
        primitive: ['String to Number', 'Boolean to String', 'Undefined to Object'],
        object: ['Object to Array', 'Function to Object', 'Date to String'],
        custom: ['Class instance mismatch', 'Interface violation', 'Type guard failure']
      },
      commonCauses: ['API contract mismatch', 'TypeScript type errors', 'Data transformation issues'],
      suggestedStrategies: ['defensive_programming', 'contract_testing', 'pattern_matching'],
      severity: 'medium'
    },
    REFERENCE_ERROR: {
      description: 'References to undefined variables or functions',
      symptoms: ['Variable not defined', 'Function not found', 'Identifier not found'],
      referenceTypes: {
        variable: ['Undefined variable', 'Hoisting issues', 'Scope problems'],
        function: ['Function not declared', 'Method not found', 'Import issues'],
        module: ['Module not found', 'Export not defined', 'Import path error']
      },
      commonCauses: ['Variable declaration issues', 'Function definition problems', 'Module import/export errors'],
      suggestedStrategies: ['environment_isolation', 'binary_search', 'pattern_matching'],
      severity: 'high'
    },
    RANGE_ERROR: {
      description: 'Numeric value outside valid range',
      symptoms: ['Invalid array length', 'Numeric range error', 'Precision loss'],
      rangeCategories: {
        array: ['Array length negative', 'Array index out of bounds'],
        numeric: ['Number too large', 'Number too small', 'Precision overflow'],
        date: ['Invalid date', 'Date range error', 'Timestamp overflow']
      },
      commonCauses: ['Invalid input validation', 'Array manipulation errors', 'Numeric calculation issues'],
      suggestedStrategies: ['defensive_programming', 'contract_testing'],
      severity: 'medium'
    }
  },

  // Integration Issues
  INTEGRATION_ISSUE: {
    API_CONTRACT_MISMATCH: {
      description: 'Frontend/backend API contract mismatches',
      symptoms: ['Unexpected response', 'Missing fields', 'Type mismatch', 'Status code error'],
      dataSources: {
        mock_api: ['Mock data structure mismatch', 'Mock response format error'],
        real_api: ['Real API response mismatch', 'API schema changes', 'Endpoint changes'],
        database: ['Query result mismatch', 'Schema changes', 'Data type mismatch']
      },
      commonCauses: ['API contract changes', 'Schema evolution', 'Documentation drift'],
      suggestedStrategies: ['contract_testing', 'data_flow_analysis', 'hypothesis_testing'],
      severity: 'medium'
    },
    AUTHENTICATION_ISSUES: {
      description: 'Authentication and authorization problems',
      symptoms: ['Unauthorized', 'Forbidden', 'Invalid token', 'Authentication failed'],
      authTypes: {
        token_based: ['JWT token issues', 'Token expiration', 'Invalid signature'],
        session_based: ['Session expiration', 'Session invalidation', 'Cookie issues'],
        oauth: ['OAuth flow errors', 'Token refresh issues', 'Permission problems']
      },
      commonCauses: ['Token management issues', 'Authentication flow problems', 'Permission configuration'],
      suggestedStrategies: ['hypothesis_testing', 'environment_isolation', 'data_flow_analysis'],
      severity: 'high'
    },
    NETWORK_ISSUES: {
      description: 'Network communication and connectivity problems',
      symptoms: ['Network error', 'Connection failed', 'Timeout', 'CORS error'],
      networkTypes: {
        connectivity: ['No internet connection', 'DNS resolution failed', 'Server unreachable'],
        cors: ['CORS policy error', 'Origin not allowed', 'Header issues'],
        timeout: ['Request timeout', 'Response timeout', 'Connection timeout']
      },
      commonCauses: ['Network connectivity problems', 'CORS misconfiguration', 'Server performance issues'],
      suggestedStrategies: ['environment_isolation', 'hypothesis_testing', 'pattern_matching'],
      severity: 'medium'
    }
  },

  // Performance Issues
  PERFORMANCE_ISSUE: {
    MEMORY_LEAK: {
      description: 'Memory not properly released causing memory leaks',
      symptoms: ['Memory usage increases', 'Garbage collection not working', 'Out of memory'],
      leakTypes: {
        event_listeners: ['Event listeners not removed', 'Memory leaks in callbacks'],
        closures: ['Closure memory leaks', 'Variable retention in closures'],
        dom_references: ['DOM references not cleared', 'Memory leaks in DOM manipulation'],
        timers: ['Timer not cleared', 'Interval memory leaks']
      },
      commonCauses: ['Improper cleanup', 'Circular references', 'Event listener management'],
      suggestedStrategies: ['performance_profiling', 'data_flow_analysis', 'hypothesis_testing'],
      severity: 'high'
    },
    CPU_INTENSIVE: {
      description: 'Operations consuming excessive CPU resources',
      symptoms: ['High CPU usage', 'Slow performance', 'Unresponsive interface'],
      operationTypes: {
        algorithms: ['Inefficient algorithms', 'High time complexity', 'Poor optimization'],
        rendering: ['Excessive re-renders', 'Large DOM updates', 'Inefficient painting'],
        calculations: ['Heavy computations', 'Large data processing', 'Complex calculations']
      },
      commonCauses: ['Inefficient algorithms', 'Excessive rendering', 'Poor optimization'],
      suggestedStrategies: ['performance_profiling', 'divide_and_conquer', 'pattern_matching'],
      severity: 'medium'
    },
    NETWORK_PERFORMANCE: {
      description: 'Network-related performance issues',
      symptoms: ['Slow requests', 'Large response sizes', 'Excessive requests'],
      networkTypes: {
        bandwidth: ['Large payloads', 'Excessive data transfer', 'Unoptimized assets'],
        latency: ['High latency', 'Slow server response', 'Network congestion'],
        request_count: ['Too many requests', 'Request batching issues', 'No caching']
      },
      commonCauses: ['Unoptimized data transfer', 'Poor caching strategy', 'Inefficient API design'],
      suggestedStrategies: ['performance_profiling', 'contract_testing', 'pattern_matching'],
      severity: 'medium'
    }
  },

  // Async Timing Issues
  ASYNC_TIMING: {
    RACE_CONDITION: {
      description: 'Concurrent operations causing inconsistent results',
      symptoms: ['Inconsistent behavior', 'Intermittent errors', 'Data corruption'],
      raceTypes: {
        data_access: ['Concurrent data modification', 'Race conditions in state updates'],
        async_operations: ['Promise race conditions', 'Async operation ordering'],
        event_handling: ['Event race conditions', 'Listener timing issues']
      },
      commonCauses: ['Missing synchronization', 'Improper async handling', 'Concurrent access patterns'],
      suggestedStrategies: ['hypothesis_testing', 'data_flow_analysis', 'defensive_programming'],
      severity: 'high'
    },
    PROMISE_CHAIN_ISSUES: {
      description: 'Promise chain and async/await handling problems',
      symptoms: ['Promise rejection', 'Unhandled promise', 'Async timing issues'],
      promiseTypes: {
        chaining: ['Promise chain errors', 'Improper chaining', 'Missing error handling'],
        async_await: ['Async/await errors', 'Missing await', 'Improper error handling'],
        concurrency: ['Promise.all errors', 'Race conditions', 'Concurrency issues']
      },
      commonCauses: ['Improper Promise handling', 'Missing error handling', 'Async timing issues'],
      suggestedStrategies: ['data_flow_analysis', 'defensive_programming', 'pattern_matching'],
      severity: 'medium'
    },
    CALLBACK_ISSUES: {
      description: 'Callback-based async operation problems',
      symptoms: ['Callback hell', 'Callback timing issues', 'Nested callback errors'],
      callbackTypes: {
        nesting: ['Deep callback nesting', 'Callback hell', 'Pyramid of doom'],
        timing: ['Callback timing issues', 'Async callback ordering', 'Race conditions'],
        error_handling: ['Callback error handling', 'Error propagation', 'Exception handling']
      },
      commonCauses: ['Complex callback structures', 'Improper error handling', 'Timing issues'],
      suggestedStrategies: ['data_flow_analysis', 'hypothesis_testing', 'pattern_matching'],
      severity: 'medium'
    }
  },

  // Security Issues
  SECURITY_ISSUE: {
    INPUT_VALIDATION: {
      description: 'Insufficient input validation leading to security vulnerabilities',
      symptoms: ['Injection attacks', 'XSS vulnerabilities', 'Data validation errors'],
      validationTypes: {
        injection: ['SQL injection', 'Code injection', 'Command injection'],
        xss: ['Cross-site scripting', 'HTML injection', 'Script injection'],
        data_validation: ['Type validation', 'Format validation', 'Range validation']
      },
      commonCauses: ['Missing input validation', 'Insufficient sanitization', 'Trust issues'],
      suggestedStrategies: ['defensive_programming', 'contract_testing', 'pattern_matching'],
      severity: 'critical'
    },
    AUTHORIZATION_ISSUES: {
      description: 'Improper authorization and access control',
      symptoms: ['Unauthorized access', 'Privilege escalation', 'Access control bypass'],
      authorizationTypes: {
        role_based: ['Role-based access control issues', 'Privilege escalation'],
        resource_based: ['Resource access control', 'Ownership verification'],
        attribute_based: ['Attribute-based access control', 'Policy violations']
      },
      commonCauses: ['Missing authorization checks', 'Improper access control', 'Policy issues'],
      suggestedStrategies: ['hypothesis_testing', 'contract_testing', 'defensive_programming'],
      severity: 'critical'
    },
    DATA_EXPOSURE: {
      description: 'Unintended data exposure and information leakage',
      symptoms: ['Data leakage', 'Information disclosure', 'Sensitive data exposure'],
      exposureTypes: {
        logging: ['Sensitive data in logs', 'Debug information leakage'],
        network: ['Unencrypted data transfer', 'Data interception'],
        storage: ['Insecure data storage', 'Data persistence issues']
      },
      commonCauses: ['Improper data handling', 'Missing encryption', 'Logging issues'],
      suggestedStrategies: ['data_flow_analysis', 'defensive_programming', 'pattern_matching'],
      severity: 'high'
    }
  }
};

// Helper types for ErrorTaxonomy
interface ErrorTaxonomy {
  [category: string]: {
    [subcategory: string]: ErrorCategory;
  };
}

interface ErrorCategory {
  description: string;
  symptoms: string[];
  frameworkSpecific?: Record<string, string[]>;
  toolSpecific?: Record<string, string[]>;
  dependencyTypes?: Record<string, string[]>;
  patterns?: Record<string, string[]>;
  typeCategories?: Record<string, string[]>;
  referenceTypes?: Record<string, string[]>;
  rangeCategories?: Record<string, string[]>;
  dataSources?: Record<string, string[]>;
  authTypes?: Record<string, string[]>;
  networkTypes?: Record<string, string[]>;
  leakTypes?: Record<string, string[]>;
  operationTypes?: Record<string, string[]>;
  bandwidthTypes?: Record<string, string[]>;
  raceTypes?: Record<string, string[]>;
  promiseTypes?: Record<string, string[]>;
  callbackTypes?: Record<string, string[]>;
  validationTypes?: Record<string, string[]>;
  authorizationTypes?: Record<string, string[]>;
  exposureTypes?: Record<string, string[]>;
  commonCauses: string[];
  suggestedStrategies: string[];
  severity: 'low' | 'medium' | 'high' | 'critical';
}
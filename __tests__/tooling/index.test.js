const Oas = require('../../tooling');
const $RefParser = require('@apidevtools/json-schema-ref-parser');
const { Operation } = require('../../tooling');
const petstore = require('@readme/oas-examples/3.0/json/petstore.json');
const circular = require('./__fixtures__/circular.json');
const petstoreServerVars = require('./__fixtures__/petstore-server-vars.json');
const serverVariables = require('./__fixtures__/server-variables.json');

test('should be able to access properties on oas', () => {
  expect(
    new Oas({
      info: { version: '1.0' },
    }).info.version
  ).toBe('1.0');
});

describe('#url([selected])', () => {
  it('should trim surrounding whitespace from the url', () => {
    expect(new Oas({ servers: [{ url: '  http://example.com/' }] }).url()).toBe('http://example.com');
  });

  it('should remove end slash from the server URL', () => {
    expect(new Oas({ servers: [{ url: 'http://example.com/' }] }).url()).toBe('http://example.com');
  });

  it('should default missing servers array to example.com', () => {
    expect(new Oas({}).url()).toBe('https://example.com');
  });

  it('should default empty servers array to example.com', () => {
    expect(new Oas({ servers: [] }).url()).toBe('https://example.com');
  });

  it('should default empty server object to example.com', () => {
    expect(new Oas({ servers: [{}] }).url()).toBe('https://example.com');
  });

  it('should add https:// if url starts with //', () => {
    expect(new Oas({ servers: [{ url: '//example.com' }] }).url()).toBe('https://example.com');
  });

  it('should add https:// if url does not start with a protocol', () => {
    expect(new Oas({ servers: [{ url: 'example.com' }] }).url()).toBe('https://example.com');
  });

  it('should accept an index for servers selection', () => {
    expect(new Oas({ servers: [{ url: 'example.com' }, { url: 'https://api.example.com' }] }).url(1)).toBe(
      'https://api.example.com'
    );
  });

  it('should default to first if selected is not valid', () => {
    expect(new Oas({ servers: [{ url: 'https://example.com' }] }).url(10)).toBe('https://example.com');
  });

  describe('server variables', () => {
    const oas = new Oas({
      servers: [
        {
          url: 'https://{name}.example.com:{port}/{basePath}',
          variables: {
            name: {
              default: 'demo',
            },
            port: {
              default: '443',
            },
            basePath: {
              default: 'v2',
            },
          },
        },
      ],
    });

    it('should use default variables if no variables are supplied', () => {
      expect(oas.url(0)).toBe('https://demo.example.com:443/v2');
    });

    it('should prefill in variables if supplied', () => {
      expect(oas.url(0, { basePath: 'v3', name: 'subdomain', port: '8080' })).toBe(
        'https://subdomain.example.com:8080/v3'
      );
    });

    it('should use defaults', () => {
      expect(
        new Oas({
          servers: [{ url: 'https://example.com/{path}', variables: { path: { default: 'path' } } }],
        }).url()
      ).toBe('https://example.com/path');
    });

    it('should use user variables over defaults', () => {
      expect(
        new Oas(
          {
            servers: [{ url: 'https://{username}.example.com', variables: { username: { default: 'demo' } } }],
          },
          { username: 'domh' }
        ).url()
      ).toBe('https://domh.example.com');
    });

    it('should fetch user variables from keys array', () => {
      expect(
        new Oas(
          {
            servers: [{ url: 'https://{username}.example.com', variables: { username: { default: 'demo' } } }],
          },
          { keys: [{ name: 1, username: 'domh' }] }
        ).url()
      ).toBe('https://domh.example.com');
    });

    it('should look for variables in selected server', () => {
      expect(
        new Oas({
          servers: [
            { url: 'https://{username1}.example.com', variables: { username1: { default: 'demo1' } } },
            { url: 'https://{username2}.example.com', variables: { username2: { default: 'demo2' } } },
          ],
        }).url(1)
      ).toBe('https://demo2.example.com');
    });

    it.skip('should fetch user variables from selected app', () => {
      expect(
        new Oas(
          {
            servers: [{ url: 'https://{username}.example.com', variables: { username: { default: 'demo' } } }],
          },
          {
            keys: [
              { name: 1, username: 'domh' },
              { name: 2, username: 'readme' },
            ],
          },
          2
        ).url()
      ).toBe('https://readme.example.com');
    });

    // Test encodeURI
    it('should pass through if no default set', () => {
      expect(new Oas({ servers: [{ url: 'https://example.com/{path}' }] }).url()).toBe('https://example.com/{path}');
    });
  });
});

describe('#replaceUrl()', () => {
  const url = 'https://{name}.example.com:{port}/{basePath}';

  it('should pull data from user variables', () => {
    const oas = new Oas({}, { name: 'mysubdomain', port: '8000', basePath: 'v5' });
    expect(oas.replaceUrl(url)).toBe('https://mysubdomain.example.com:8000/v5');
  });

  it('should use template names as variables if no variables are supplied', () => {
    expect(new Oas().replaceUrl(url)).toBe(url);
  });

  it('should allow variables to come in as an object of defaults from `oas.defaultVariables`', () => {
    expect(
      new Oas().replaceUrl(url, {
        name: {
          default: 'demo',
        },
        port: {
          default: '443',
        },
        basePath: {
          default: 'v2',
        },
      })
    ).toBe('https://demo.example.com:443/v2');
  });

  it('should allow variable key-value pairs to be supplied', () => {
    expect(
      new Oas().replaceUrl(url, {
        name: 'subdomain',
        port: '8080',
        basePath: 'v3',
      })
    ).toBe('https://subdomain.example.com:8080/v3');
  });

  it('should not fail if the variable objects are in weird shapes', () => {
    expect(
      new Oas().replaceUrl(url, {
        name: {
          def: 'demo',
        },
        port: '443',
        basePath: [{ default: 'v2' }],
      })
    ).toBe('https://{name}.example.com:443/{basePath}');
  });
});

describe('#splitUrl()', () => {
  it('should split url into chunks', () => {
    expect(
      new Oas({
        servers: [{ url: 'https://example.com/{path}' }],
      }).splitUrl()
    ).toStrictEqual([
      { key: 'https://example.com/-0', type: 'text', value: 'https://example.com/' },
      { key: 'path-1', type: 'variable', value: 'path', description: undefined, enum: undefined },
    ]);
  });

  // Taken from here: https://github.com/readmeio/readme/blob/09ab5aab1836ec1b63d513d902152aa7cfac6e4d/packages/explorer/__tests__/PathUrl.test.jsx#L99-L111
  it('should work for multiple path params', () => {
    expect(
      new Oas({
        servers: [{ url: 'https://example.com/{a}/{b}/c' }],
      }).splitUrl()
    ).toHaveLength(5);
    expect(
      new Oas({
        servers: [{ url: 'https://example.com/v1/flight/{FlightID}/sitezonetargeting/{SiteZoneTargetingID}' }],
      }).splitUrl()
    ).toHaveLength(4);
  });

  it('should create unique keys for duplicate values', () => {
    expect(
      new Oas({
        servers: [{ url: 'https://example.com/{test}/{test}' }],
      }).splitUrl()
    ).toStrictEqual([
      { key: 'https://example.com/-0', type: 'text', value: 'https://example.com/' },
      { key: 'test-1', type: 'variable', value: 'test', description: undefined, enum: undefined },
      { key: '/-2', type: 'text', value: '/' },
      { key: 'test-3', type: 'variable', value: 'test', description: undefined, enum: undefined },
    ]);
  });

  it('should return with description', () => {
    expect(
      new Oas({
        servers: [{ url: 'https://example.com/{path}', variables: { path: { description: 'path description' } } }],
      }).splitUrl()[1].description
    ).toStrictEqual('path description');
  });

  it('should return with enum values', () => {
    expect(
      new Oas({
        servers: [{ url: 'https://example.com/{path}', variables: { path: { enum: ['v1', 'v2'] } } }],
      }).splitUrl()[1].enum
    ).toStrictEqual(['v1', 'v2']);
  });
});

describe('#variables([selected])', () => {
  it('should return with list of variables', () => {
    const variables = { path: { description: 'path description' } };
    expect(
      new Oas({
        servers: [{ url: 'https://example.com/{path}', variables }],
      }).variables()
    ).toStrictEqual(variables);
  });

  it('should return with empty object if out of bounds', () => {
    expect(
      new Oas({
        servers: [{ url: 'https://example.com/{path}', variables: { path: { description: 'path description' } } }],
      }).variables(10)
    ).toStrictEqual({});
  });
});

describe('#defaultVariables([selected])', () => {
  it('should return with list of variables', () => {
    expect(
      new Oas({
        servers: [
          {
            url: 'https://example.com/{path}',
            variables: {
              path: { description: 'path description' },
              port: { default: '8000' },
            },
          },
        ],
      }).defaultVariables()
    ).toStrictEqual({ path: '', port: '8000' });
  });

  it('should embellish with user variables', () => {
    expect(
      new Oas(
        {
          servers: [
            {
              url: 'https://example.com/{path}',
              variables: {
                path: { description: 'path description' },
                port: { default: '8000' },
              },
            },
          ],
        },
        {
          path: 'user-path',
        }
      ).defaultVariables()
    ).toStrictEqual({ path: 'user-path', port: '8000' });
  });

  it('should return with empty object if out of bounds', () => {
    expect(
      new Oas({
        servers: [{ url: 'https://example.com/{path}', variables: { path: { description: 'path description' } } }],
      }).variables(10)
    ).toStrictEqual({});
  });
});

describe('#operation()', () => {
  it('should return an operation object', () => {
    const operation = new Oas(petstore).operation('/pet', 'post');
    expect(operation).toBeInstanceOf(Operation);
    expect(operation.schema.tags).toStrictEqual(['pet']);
    expect(operation.path).toBe('/pet');
    expect(operation.method).toBe('post');
  });

  it('should return a default when no operation', () => {
    expect(new Oas({}).operation('/unknown', 'get')).toMatchSnapshot();
  });

  it('should return an operation object with security if it has security', () => {
    const operation = new Oas(petstore).operation('/pet', 'put');
    expect(operation.getSecurity()).toStrictEqual([{ petstore_auth: ['write:pets', 'read:pets'] }]);
  });

  it("should still return an operation object if the operation isn't found", () => {
    const operation = new Oas(petstore).operation('/pet', 'patch');
    expect(operation.schema).toBeDefined();
  });
});

describe('#findOperation()', () => {
  it('should return undefined if no server found', () => {
    const oas = new Oas(petstore);
    const uri = 'http://localhost:3000/pet/1';
    const method = 'delete';

    const res = oas.findOperation(uri, method);
    expect(res).toBeUndefined();
  });

  it('should return undefined if origin is correct but unable to extract path', () => {
    const oas = new Oas(petstore);
    const uri = 'http://petstore.swagger.io/';
    const method = 'get';

    const res = oas.findOperation(uri, method);
    expect(res).toBeUndefined();
  });

  it('should return undefined if no path matches found', () => {
    const oas = new Oas(petstore);
    const uri = 'http://petstore.swagger.io/v2/search';
    const method = 'get';

    const res = oas.findOperation(uri, method);
    expect(res).toBeUndefined();
  });

  it('should return undefined if no matching methods in path', () => {
    const oas = new Oas(petstore);
    const uri = 'http://petstore.swagger.io/v2/pet/1';
    const method = 'patch';

    const res = oas.findOperation(uri, method);
    expect(res).toBeUndefined();
  });

  it('should return a result if found', () => {
    const oas = new Oas(petstore);
    const uri = 'http://petstore.swagger.io/v2/pet/1';
    const method = 'delete';

    const res = oas.findOperation(uri, method);
    expect(res).toMatchObject({
      url: {
        origin: 'http://petstore.swagger.io/v2',
        path: '/pet/:petId',
        slugs: {
          ':petId': '1',
        },
        method: 'DELETE',
      },
    });
  });

  it('should return normally if path is formatted poorly', () => {
    const oas = new Oas(petstore);
    const uri = 'http://petstore.swagger.io/v2/pet/1/';
    const method = 'delete';

    const res = oas.findOperation(uri, method);
    expect(res).toMatchObject({
      url: {
        origin: 'http://petstore.swagger.io/v2',
        path: '/pet/:petId',
        slugs: {
          ':petId': '1',
        },
        method: 'DELETE',
      },
    });
  });

  it('should return object if query string is included', () => {
    const oas = new Oas(petstore);
    const uri = 'http://petstore.swagger.io/v2/pet/findByStatus?test=2';
    const method = 'get';

    const res = oas.findOperation(uri, method);
    expect(res).toMatchObject({
      url: {
        origin: 'http://petstore.swagger.io/v2',
        path: '/pet/findByStatus',
        slugs: {},
        method: 'GET',
      },
    });
  });

  it('should support schemeless servers', () => {
    const schemeless = JSON.parse(JSON.stringify(petstore));
    schemeless.servers = [{ url: '//petstore.swagger.io/v2' }];

    const oas = new Oas(schemeless);
    const uri = 'http://petstore.swagger.io/v2/pet/findByStatus?test=2';
    const method = 'get';

    const res = oas.findOperation(uri, method);
    expect(res).toMatchObject({
      url: {
        origin: '//petstore.swagger.io/v2',
        path: '/pet/findByStatus',
        slugs: {},
        method: 'GET',
      },
    });
  });

  it('should return result if server has a trailing slash', () => {
    const oas = new Oas({
      openapi: '3.0.0',
      servers: [
        {
          url: 'https://example.com/',
        },
      ],
      paths: {
        '/pets/:id': {
          get: {
            responses: {
              200: {
                description: 'OK',
              },
            },
          },
        },
      },
    });

    const uri = 'https://example.com/pets/:id';
    const method = 'get';

    const res = oas.findOperation(uri, method);
    expect(res.url).toStrictEqual({
      origin: 'https://example.com',
      path: '/pets/:id',
      nonNormalizedPath: '/pets/:id',
      slugs: { ':id': ':id' },
      method: 'GET',
    });
  });

  it('should return result if path is slash', () => {
    const oas = new Oas({
      openapi: '3.0.0',
      servers: [
        {
          url: 'https://example.com',
        },
      ],
      paths: {
        '/': {
          get: {
            responses: {
              200: {
                description: 'OK',
              },
            },
          },
        },
      },
    });

    const uri = 'https://example.com';
    const method = 'get';

    const res = oas.findOperation(uri, method);
    expect(res.url).toStrictEqual({
      origin: 'https://example.com',
      path: '/',
      nonNormalizedPath: '/',
      slugs: {},
      method: 'GET',
    });

    expect(res.operation).toStrictEqual({
      responses: {
        200: {
          description: 'OK',
        },
      },
    });
  });

  it('should return result if in server variable defaults', () => {
    const oas = new Oas(serverVariables);
    const uri = 'https://demo.example.com:443/v2/post';
    const method = 'post';

    const res = oas.findOperation(uri, method);
    expect(res).toMatchObject({
      url: {
        origin: 'https://demo.example.com:443/v2',
        path: '/post',
        nonNormalizedPath: '/post',
        slugs: {},
        method: 'POST',
      },
      operation: {
        summary: 'Should fetch variables from defaults and user values',
        description: '',
        parameters: [],
        responses: {},
      },
    });
  });

  it('should render any target server variable defaults', () => {
    const oas = new Oas(petstoreServerVars);
    const uri = 'http://petstore.swagger.io/v2/pet';
    const method = 'post';

    const res = oas.findOperation(uri, method);
    expect(res).toMatchObject({
      url: {
        origin: 'http://petstore.swagger.io/v2',
        path: '/pet',
        nonNormalizedPath: '/pet',
        slugs: {},
        method: 'POST',
      },
      operation: {
        summary: 'Add a new pet to the store',
        description: '',
        responses: {},
      },
    });
  });

  it('should not overwrite the servers in the core OAS while looking for matches', () => {
    const oas = new Oas(serverVariables);
    const uri = 'https://demo.example.com:443/v2/post';
    const method = 'post';

    expect(oas.servers[0].url).toStrictEqual('https://{name}.example.com:{port}/{basePath}');

    const res = oas.findOperation(uri, method);
    expect(res.url).toMatchObject({
      origin: 'https://demo.example.com:443/v2',
      path: '/post',
      nonNormalizedPath: '/post',
      slugs: {},
      method: 'POST',
    });

    expect(oas.servers[0].url).toStrictEqual('https://{name}.example.com:{port}/{basePath}');
  });
});

// Since this is just a wrapper for findOperation, we don't need to re-test everything that the tests for that does. All
// we need to know is that if findOperation fails this fails, as well as the reverse.
describe('#getOperation()', () => {
  it('should return undefined if #findOperation returns undefined', () => {
    const oas = new Oas(petstore);
    const uri = 'http://localhost:3000/pet/1';
    const method = 'delete';

    expect(oas.getOperation(uri, method)).toBeUndefined();
  });

  it('should return a result if found', () => {
    const oas = new Oas(petstore);
    const uri = 'http://petstore.swagger.io/v2/pet/1';
    const method = 'delete';

    const res = oas.getOperation(uri, method);

    expect(res).toBeInstanceOf(Operation);
    expect(res.path).toBe('/pet/{petId}');
    expect(res.method).toBe('delete');
  });

  it('should have security present on an operation that has it', () => {
    const oas = new Oas(petstore);
    const security = [{ petstore_auth: ['write:pets', 'read:pets'] }];

    expect(petstore.paths['/pet'].put.security).toStrictEqual(security);

    const res = oas.getOperation('http://petstore.swagger.io/v2/pet', 'put');
    expect(res.getSecurity()).toStrictEqual(security);
  });

  it('should handle paths with uri templates', () => {
    const oas = new Oas(petstore);
    const operation = oas.getOperation('http://petstore.swagger.io/v2/store/order/1234', 'get');

    expect(operation.schema.parameters).toHaveLength(1);
    expect(operation.schema.operationId).toBe('getOrderById');
    expect(operation.path).toBe('/store/order/{orderId}');
    expect(operation.method).toBe('get');
  });

  describe('server variables', () => {
    const apiDefinition = {
      servers: [
        {
          url: 'https://{region}.node.example.com/v14',
          variables: {
            region: {
              default: 'us',
              enum: ['us', 'eu'],
            },
          },
        },
      ],
      paths: {
        '/api/esm': {
          put: {
            responses: {
              200: {
                description: '200',
              },
            },
          },
        },
      },
    };

    it('should be able to find an operation where the variable matches the url', () => {
      const source = {
        url: 'https://eu.node.example.com/v14/api/esm',
        method: 'put',
      };

      const method = source.method.toLowerCase();
      const oas = new Oas(apiDefinition, { region: 'eu' });
      const operation = oas.getOperation(source.url, method);

      expect(operation).toBeDefined();
      expect(operation.path).toBe('/api/esm');
      expect(operation.method).toBe('put');
    });

    it("should be able to find an operation where the variable **doesn't** match the url", () => {
      const source = {
        url: 'https://eu.node.example.com/v14/api/esm',
        method: 'put',
      };

      const method = source.method.toLowerCase();
      const oas = new Oas(apiDefinition, { region: 'us' });
      const operation = oas.getOperation(source.url, method);

      expect(operation).toBeDefined();
      expect(operation.path).toBe('/api/esm');
      expect(operation.method).toBe('put');
    });

    it('should be able to find an operation if there are no user variables present', () => {
      const source = {
        url: 'https://eu.node.example.com/v14/api/esm',
        method: 'put',
      };

      const method = source.method.toLowerCase();
      const oas = new Oas(apiDefinition);
      const operation = oas.getOperation(source.url, method);

      expect(operation).toBeDefined();
      expect(operation.path).toBe('/api/esm');
      expect(operation.method).toBe('put');
    });

    it('should fail to find a match on a url that doesnt quite match', () => {
      const source = {
        url: 'https://eu.buster.example.com/v14/api/esm',
        method: 'put',
      };

      const method = source.method.toLowerCase();
      const oas = new Oas(apiDefinition, { region: 'us' });
      const operation = oas.getOperation(source.url, method);

      expect(operation).toBeUndefined();
    });

    it('should be able to find a match on a url with an server OAS that doesnt have fleshed out server variables', () => {
      const oas = new Oas({
        servers: [{ url: 'https://{region}.node.example.com/v14' }],
        paths: {
          '/api/esm': {
            put: {
              responses: {
                200: {
                  description: '200',
                },
              },
            },
          },
        },
      });

      const source = {
        url: 'https://us.node.example.com/v14/api/esm',
        method: 'put',
      };

      const method = source.method.toLowerCase();
      const operation = oas.getOperation(source.url, method);

      expect(operation).toBeDefined();
      expect(operation.path).toBe('/api/esm');
      expect(operation.method).toBe('put');
    });
  });
});

describe('#findOperationWithoutMethod()', () => {
  it('should return undefined if no server found', () => {
    const oas = new Oas(petstore);
    const uri = 'http://localhost:3000/pet/1';

    const res = oas.findOperationWithoutMethod(uri);
    expect(res).toBeUndefined();
  });

  it('should return undefined if origin is correct but unable to extract path', () => {
    const oas = new Oas(petstore);
    const uri = 'http://petstore.swagger.io/';

    const res = oas.findOperationWithoutMethod(uri);
    expect(res).toBeUndefined();
  });

  it('should return undefined if no path matches found', () => {
    const oas = new Oas(petstore);
    const uri = 'http://petstore.swagger.io/v2/search';

    const res = oas.findOperationWithoutMethod(uri);
    expect(res).toBeUndefined();
  });

  it('should return all results for valid path match', () => {
    const oas = new Oas(petstore);
    const uri = 'http://petstore.swagger.io/v2/pet/1';

    const res = oas.findOperationWithoutMethod(uri);
    const petIndexResult = petstore.paths['/pet/{petId}'];

    const expected = {
      match: {
        index: 0,
        params: {
          petId: '1',
        },
        path: '/pet/1',
      },
      operation: {
        ...petIndexResult,
      },
      url: {
        nonNormalizedPath: '/pet/{petId}',
        origin: 'http://petstore.swagger.io/v2',
        path: '/pet/:petId',
        slugs: {
          ':petId': '1',
        },
      },
    };

    expect(res).toMatchObject(expected);
  });
});

describe('#dereference()', () => {
  it('should not fail on an empty OAS', () => {
    const oas = new Oas();

    expect(async () => {
      await oas.dereference();
    }).not.toThrow();
  });

  it('should dereference the current OAS', async () => {
    const oas = new Oas(petstore);

    expect(oas.paths['/pet'].post.requestBody).toStrictEqual({
      $ref: '#/components/requestBodies/Pet',
    });

    await oas.dereference();

    expect(oas.paths['/pet'].post.requestBody).toStrictEqual({
      content: {
        'application/json': {
          schema: oas.components.schemas.Pet,
        },
        'application/xml': {
          schema: oas.components.schemas.Pet,
        },
      },
      description: 'Pet object that needs to be added to the store',
      required: true,
    });
  });

  it('should retain the user object when dereferencing', async () => {
    const oas = new Oas(petstore, {
      username: 'buster',
    });

    expect(oas.user).toStrictEqual({
      username: 'buster',
    });

    await oas.dereference();

    expect(oas.paths['/pet'].post.requestBody).toStrictEqual({
      content: expect.any(Object),
      description: 'Pet object that needs to be added to the store',
      required: true,
    });

    // User data should remain unchanged
    expect(oas.user).toStrictEqual({
      username: 'buster',
    });
  });

  it('should be able to handle a circular schema without erroring', async () => {
    const oas = new Oas(circular);

    await oas.dereference();

    // $refs should remain in the OAS because they're circular and are ignored.
    expect(oas.paths['/'].get).toStrictEqual({
      responses: {
        200: {
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  dateTime: { type: 'string', format: 'date-time' },
                  offsetAfter: { $ref: '#/components/schemas/offset' },
                  offsetBefore: { $ref: '#/components/schemas/offset' },
                },
              },
            },
          },
        },
      },
    });
  });

  describe('blocking', () => {
    it('should only dereference once when called multiple times', async () => {
      const spy = jest.spyOn($RefParser, 'dereference');
      const oas = new Oas(petstore);

      await Promise.all([oas.dereference(), oas.dereference(), oas.dereference()]);

      expect(spy).toHaveBeenCalledTimes(1);
      expect(oas._dereferencing).toStrictEqual({ processing: false, complete: true });
      expect(oas.paths['/pet'].post.requestBody).not.toStrictEqual({
        $ref: '#/components/requestBodies/Pet',
      });

      spy.mockRestore();
    });

    it('should only **ever** dereference once', async () => {
      const spy = jest.spyOn($RefParser, 'dereference');
      const oas = new Oas(petstore);

      await oas.dereference();
      expect(oas._dereferencing).toStrictEqual({ processing: false, complete: true });
      expect(oas.paths['/pet'].post.requestBody).not.toStrictEqual({
        $ref: '#/components/requestBodies/Pet',
      });

      await oas.dereference();
      expect(oas._dereferencing).toStrictEqual({ processing: false, complete: true });
      expect(oas.paths['/pet'].post.requestBody).not.toStrictEqual({
        $ref: '#/components/requestBodies/Pet',
      });

      expect(spy).toHaveBeenCalledTimes(1);
      spy.mockRestore();
    });
  });
});

/**
 * Base Serialization support
 * Provides JSON serialization with type information for polymorphic deserialization
 */

export interface Serializable {
  /**
   * Serialize to JSON with type information
   */
  toJSON(): Record<string, any>;
}

/**
 * Serialize an object with its class type information
 */
export function serializeWithType(obj: any): Record<string, any> {
  const data = typeof obj.toJSON === 'function' ? obj.toJSON() : { ...obj };
  
  // Add type information
  data.__type = obj.constructor.name;
  data.__module = obj.constructor.name; // For compatibility
  
  return data;
}

/**
 * Deserialize an object from JSON with type information
 * @param data - Serialized data with __type field
 * @param classRegistry - Map of class names to constructors
 */
export function deserializeWithType<T>(
  data: Record<string, any>,
  classRegistry: Map<string, new (...args: any[]) => T>
): T {
  const typeName = data.__type || data.__module;
  
  if (!typeName) {
    throw new Error('Cannot deserialize: missing type information');
  }
  
  const ClassConstructor = classRegistry.get(typeName);
  
  if (!ClassConstructor) {
    throw new Error(`Cannot deserialize: unknown type "${typeName}"`);
  }
  
  // Remove type metadata
  const { __type, __module, ...cleanData } = data;
  
  // Check if class has a fromJSON static method
  if (typeof (ClassConstructor as any).fromJSON === 'function') {
    return (ClassConstructor as any).fromJSON(cleanData);
  }
  
  // Otherwise, create instance and assign properties
  const instance = new ClassConstructor();
  Object.assign(instance, cleanData);
  
  return instance;
}

/**
 * Base class with serialization support
 */
export abstract class SerializableBase implements Serializable {
  /**
   * Serialize to JSON
   */
  toJSON(): Record<string, any> {
    const data: Record<string, any> = {};
    
    // Copy all own properties
    for (const key of Object.keys(this)) {
      const value = (this as any)[key];
      
      // Handle different value types
      if (value === undefined) {
        continue; // Skip undefined values
      } else if (value === null) {
        data[key] = null;
      } else if (typeof value.toJSON === 'function') {
        data[key] = value.toJSON();
      } else if (value instanceof Set) {
        data[key] = Array.from(value);
      } else if (value instanceof Map) {
        data[key] = Object.fromEntries(value);
      } else if (Array.isArray(value)) {
        data[key] = value.map((item) =>
          typeof item.toJSON === 'function' ? item.toJSON() : item
        );
      } else {
        data[key] = value;
      }
    }
    
    // Add type information
    data.__type = this.constructor.name;
    
    return data;
  }

  /**
   * Create a deep copy of the object
   */
  clone(): this {
    const data = this.toJSON();
    const instance = Object.create(Object.getPrototypeOf(this));
    Object.assign(instance, data);
    return instance;
  }
}

export default SerializableBase;


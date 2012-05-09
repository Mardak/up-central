/* -*- Mode: C++; tab-width: 8; indent-tabs-mode: nil; c-basic-offset: 4 -*-
 * vim: set ts=8 sw=4 et tw=78:
 *
 * ***** BEGIN LICENSE BLOCK *****
 * Version: MPL 1.1/GPL 2.0/LGPL 2.1
 *
 * The contents of this file are subject to the Mozilla Public License Version
 * 1.1 (the "License"); you may not use this file except in compliance with
 * the License. You may obtain a copy of the License at
 * http://www.mozilla.org/MPL/
 *
 * Software distributed under the License is distributed on an "AS IS" basis,
 * WITHOUT WARRANTY OF ANY KIND, either express or implied. See the License
 * for the specific language governing rights and limitations under the
 * License.
 *
 * The Original Code is SpiderMonkey global object code.
 *
 * The Initial Developer of the Original Code is
 * the Mozilla Foundation.
 * Portions created by the Initial Developer are Copyright (C) 2011
 * the Initial Developer. All Rights Reserved.
 *
 * Contributor(s):
 *   Jeff Walden <jwalden+code@mit.edu> (original author)
 *
 * Alternatively, the contents of this file may be used under the terms of
 * either of the GNU General Public License Version 2 or later (the "GPL"),
 * or the GNU Lesser General Public License Version 2.1 or later (the "LGPL"),
 * in which case the provisions of the GPL or the LGPL are applicable instead
 * of those above. If you wish to allow use of your version of this file only
 * under the terms of either the GPL or the LGPL, and not to allow others to
 * use your version of this file under the terms of the MPL, indicate your
 * decision by deleting the provisions above and replace them with the notice
 * and other provisions required by the GPL or the LGPL. If you do not delete
 * the provisions above, a recipient may use your version of this file under
 * the terms of any one of the MPL, the GPL or the LGPL.
 *
 * ***** END LICENSE BLOCK ***** */

#ifndef GlobalObject_h___
#define GlobalObject_h___

#include "mozilla/Attributes.h"

#include "jsarray.h"
#include "jsbool.h"
#include "jsexn.h"
#include "jsfun.h"
#include "jsiter.h"
#include "jsnum.h"

#include "js/Vector.h"

#include "builtin/RegExp.h"

extern JSObject *
js_InitObjectClass(JSContext *cx, JSObject *obj);

extern JSObject *
js_InitFunctionClass(JSContext *cx, JSObject *obj);

extern JSObject *
js_InitTypedArrayClasses(JSContext *cx, JSObject *obj);

namespace js {

class Debugger;

/*
 * Global object slots are reserved as follows:
 *
 * [0, JSProto_LIMIT)
 *   Stores the original value of the constructor for the corresponding
 *   JSProtoKey.
 * [JSProto_LIMIT, 2 * JSProto_LIMIT)
 *   Stores the prototype, if any, for the constructor for the corresponding
 *   JSProtoKey offset from JSProto_LIMIT.
 * [2 * JSProto_LIMIT, 3 * JSProto_LIMIT)
 *   Stores the current value of the global property named for the JSProtoKey
 *   for the corresponding JSProtoKey offset from 2 * JSProto_LIMIT.
 * [3 * JSProto_LIMIT, RESERVED_SLOTS)
 *   Various one-off values: ES5 13.2.3's [[ThrowTypeError]], RegExp statics,
 *   the Namespace object for E4X's function::, the original eval for this
 *   global object (implementing |var eval = otherWindow.eval; eval(...)| as an
 *   indirect eval), a bit indicating whether this object has been cleared
 *   (see JS_ClearScope), and a cache for whether eval is allowed (per the
 *   global's Content Security Policy).
 *
 * The first two ranges are necessary to implement js::FindClassObject,
 * js::FindClassPrototype, and spec language speaking in terms of "the original
 * Array prototype object", or "as if by the expression new Array()" referring
 * to the original Array constructor.  The third range stores the (writable and
 * even deletable) Object, Array, &c. properties (although a slot won't be used
 * again if its property is deleted and readded).
 */
class GlobalObject : public JSObject
{
    /*
     * Count of slots to store built-in constructors, prototypes, and initial
     * visible properties for the constructors.
     */
    static const unsigned STANDARD_CLASS_SLOTS  = JSProto_LIMIT * 3;

    /* One-off properties stored after slots for built-ins. */
    static const unsigned THROWTYPEERROR          = STANDARD_CLASS_SLOTS;
    static const unsigned GENERATOR_PROTO         = THROWTYPEERROR + 1;
    static const unsigned REGEXP_STATICS          = GENERATOR_PROTO + 1;
    static const unsigned FUNCTION_NS             = REGEXP_STATICS + 1;
    static const unsigned RUNTIME_CODEGEN_ENABLED = FUNCTION_NS + 1;
    static const unsigned EVAL                    = RUNTIME_CODEGEN_ENABLED + 1;
    static const unsigned FLAGS                   = EVAL + 1;
    static const unsigned DEBUGGERS               = FLAGS + 1;

    /* Total reserved-slot count for global objects. */
    static const unsigned RESERVED_SLOTS = DEBUGGERS + 1;

    void staticAsserts() {
        /*
         * The slot count must be in the public API for JSCLASS_GLOBAL_FLAGS,
         * and we aren't going to expose GlobalObject, so just assert that the
         * two values are synchronized.
         */
        JS_STATIC_ASSERT(JSCLASS_GLOBAL_SLOT_COUNT == RESERVED_SLOTS);
    }

    static const int32_t FLAGS_CLEARED = 0x1;

    inline void setFlags(int32_t flags);
    inline void initFlags(int32_t flags);

    friend JSObject *
    ::js_InitObjectClass(JSContext *cx, JSObject *obj);
    friend JSObject *
    ::js_InitFunctionClass(JSContext *cx, JSObject *obj);

    /* Initialize the Function and Object classes.  Must only be called once! */
    JSObject *
    initFunctionAndObjectClasses(JSContext *cx);

    inline void setDetailsForKey(JSProtoKey key, JSObject *ctor, JSObject *proto);
    inline void setObjectClassDetails(JSFunction *ctor, JSObject *proto);
    inline void setFunctionClassDetails(JSFunction *ctor, JSObject *proto);

    inline void setThrowTypeError(JSFunction *fun);

    inline void setOriginalEval(JSObject *evalobj);

    Value getConstructor(JSProtoKey key) const {
        JS_ASSERT(key <= JSProto_LIMIT);
        return getSlot(key);
    }

    Value getPrototype(JSProtoKey key) const {
        JS_ASSERT(key <= JSProto_LIMIT);
        return getSlot(JSProto_LIMIT + key);
    }

    bool classIsInitialized(JSProtoKey key) const {
        bool inited = !getConstructor(key).isUndefined();
        JS_ASSERT(inited == !getPrototype(key).isUndefined());
        return inited;
    }

    bool functionObjectClassesInitialized() const {
        bool inited = classIsInitialized(JSProto_Function);
        JS_ASSERT(inited == classIsInitialized(JSProto_Object));
        return inited;
    }

    bool arrayClassInitialized() const {
        return classIsInitialized(JSProto_Array);
    }

    bool booleanClassInitialized() const {
        return classIsInitialized(JSProto_Boolean);
    }
    bool numberClassInitialized() const {
        return classIsInitialized(JSProto_Number);
    }
    bool stringClassInitialized() const {
        return classIsInitialized(JSProto_String);
    }
    bool regexpClassInitialized() const {
        return classIsInitialized(JSProto_RegExp);
    }
    bool arrayBufferClassInitialized() const {
        return classIsInitialized(JSProto_ArrayBuffer);
    }
    bool errorClassesInitialized() const {
        return classIsInitialized(JSProto_Error);
    }

  public:
    static GlobalObject *create(JSContext *cx, Class *clasp);

    /*
     * Create a constructor function with the specified name and length using
     * ctor, a method which creates objects with the given class.
     */
    JSFunction *
    createConstructor(JSContext *cx, JSNative ctor, JSAtom *name, unsigned length,
                      gc::AllocKind kind = JSFunction::FinalizeKind);

    /*
     * Create an object to serve as [[Prototype]] for instances of the given
     * class, using |Object.prototype| as its [[Prototype]].  Users creating
     * prototype objects with particular internal structure (e.g. reserved
     * slots guaranteed to contain values of particular types) must immediately
     * complete the minimal initialization to make the returned object safe to
     * touch.
     */
    JSObject *createBlankPrototype(JSContext *cx, js::Class *clasp);

    /*
     * Identical to createBlankPrototype, but uses proto as the [[Prototype]]
     * of the returned blank prototype.
     */
    JSObject *createBlankPrototypeInheriting(JSContext *cx, js::Class *clasp, JSObject &proto);

    JSObject *getOrCreateObjectPrototype(JSContext *cx) {
        GlobalObject *self = this;
        if (!functionObjectClassesInitialized()) {
            Root<GlobalObject*> root(cx, &self);
            if (!initFunctionAndObjectClasses(cx))
                return NULL;
        }
        return &self->getPrototype(JSProto_Object).toObject();
    }

    JSObject *getOrCreateFunctionPrototype(JSContext *cx) {
        GlobalObject *self = this;
        if (!functionObjectClassesInitialized()) {
            Root<GlobalObject*> root(cx, &self);
            if (!initFunctionAndObjectClasses(cx))
                return NULL;
        }
        return &self->getPrototype(JSProto_Function).toObject();
    }

    JSObject *getOrCreateArrayPrototype(JSContext *cx) {
        GlobalObject *self = this;
        if (!arrayClassInitialized()) {
            Root<GlobalObject*> root(cx, &self);
            if (!js_InitArrayClass(cx, this))
                return NULL;
        }
        return &self->getPrototype(JSProto_Array).toObject();
    }

    JSObject *getOrCreateBooleanPrototype(JSContext *cx) {
        GlobalObject *self = this;
        if (!booleanClassInitialized()) {
            Root<GlobalObject*> root(cx, &self);
            if (!js_InitBooleanClass(cx, this))
                return NULL;
        }
        return &self->getPrototype(JSProto_Boolean).toObject();
    }

    JSObject *getOrCreateNumberPrototype(JSContext *cx) {
        GlobalObject *self = this;
        if (!numberClassInitialized()) {
            Root<GlobalObject*> root(cx, &self);
            if (!js_InitNumberClass(cx, this))
                return NULL;
        }
        return &self->getPrototype(JSProto_Number).toObject();
    }

    JSObject *getOrCreateStringPrototype(JSContext *cx) {
        GlobalObject *self = this;
        if (!stringClassInitialized()) {
            Root<GlobalObject*> root(cx, &self);
            if (!js_InitStringClass(cx, this))
                return NULL;
        }
        return &self->getPrototype(JSProto_String).toObject();
    }

    JSObject *getOrCreateRegExpPrototype(JSContext *cx) {
        GlobalObject *self = this;
        if (!regexpClassInitialized()) {
            Root<GlobalObject*> root(cx, &self);
            if (!js_InitRegExpClass(cx, this))
                return NULL;
        }
        return &self->getPrototype(JSProto_RegExp).toObject();
    }

    JSObject *getOrCreateArrayBufferPrototype(JSContext *cx) {
        GlobalObject *self = this;
        if (!arrayBufferClassInitialized()) {
            Root<GlobalObject*> root(cx, &self);
            if (!js_InitTypedArrayClasses(cx, this))
                return NULL;
        }
        return &self->getPrototype(JSProto_ArrayBuffer).toObject();
    }

    JSObject *getOrCreateCustomErrorPrototype(JSContext *cx, int exnType) {
        GlobalObject *self = this;
        JSProtoKey key = GetExceptionProtoKey(exnType);
        if (!errorClassesInitialized()) {
            Root<GlobalObject*> root(cx, &self);
            if (!js_InitExceptionClasses(cx, this))
                return NULL;
        }
        return &self->getPrototype(key).toObject();
    }

    JSObject *getOrCreateGeneratorPrototype(JSContext *cx) {
        GlobalObject *self = this;
        Value v = getSlotRef(GENERATOR_PROTO);
        if (!v.isObject()) {
            Root<GlobalObject*> root(cx, &self);
            if (!js_InitIteratorClasses(cx, this))
                return NULL;
        }
        return &self->getSlot(GENERATOR_PROTO).toObject();
    }

    inline RegExpStatics *getRegExpStatics() const;

    JSObject *getThrowTypeError() const {
        JS_ASSERT(functionObjectClassesInitialized());
        return &getSlot(THROWTYPEERROR).toObject();
    }

    void clear(JSContext *cx);

    bool isCleared() const {
        return getSlot(FLAGS).toInt32() & FLAGS_CLEARED;
    }

    bool isRuntimeCodeGenEnabled(JSContext *cx);

    const Value &getOriginalEval() const {
        JS_ASSERT(getSlot(EVAL).isObject());
        return getSlot(EVAL);
    }

    bool getFunctionNamespace(JSContext *cx, Value *vp);

    static bool initGeneratorClass(JSContext *cx, Handle<GlobalObject*> global);
    static bool initStandardClasses(JSContext *cx, Handle<GlobalObject*> global);

    typedef js::Vector<js::Debugger *, 0, js::SystemAllocPolicy> DebuggerVector;

    /*
     * The collection of Debugger objects debugging this global. If this global
     * is not a debuggee, this returns either NULL or an empty vector.
     */
    DebuggerVector *getDebuggers();

    /*
     * The same, but create the empty vector if one does not already
     * exist. Returns NULL only on OOM.
     */
    static DebuggerVector *getOrCreateDebuggers(JSContext *cx, Handle<GlobalObject*> global);

    static bool addDebugger(JSContext *cx, Handle<GlobalObject*> global, Debugger *dbg);
};

/*
 * Define ctor.prototype = proto as non-enumerable, non-configurable, and
 * non-writable; define proto.constructor = ctor as non-enumerable but
 * configurable and writable.
 */
extern bool
LinkConstructorAndPrototype(JSContext *cx, JSObject *ctor, JSObject *proto);

/*
 * Define properties, then functions, on the object, then brand for tracing
 * benefits.
 */
extern bool
DefinePropertiesAndBrand(JSContext *cx, JSObject *obj, JSPropertySpec *ps, JSFunctionSpec *fs);

typedef HashSet<GlobalObject *, DefaultHasher<GlobalObject *>, SystemAllocPolicy> GlobalObjectSet;

} // namespace js

inline bool
JSObject::isGlobal() const
{
    return !!(js::GetObjectClass(this)->flags & JSCLASS_IS_GLOBAL);
}

js::GlobalObject &
JSObject::asGlobal()
{
    JS_ASSERT(isGlobal());
    return *static_cast<js::GlobalObject *>(this);
}

#endif /* GlobalObject_h___ */

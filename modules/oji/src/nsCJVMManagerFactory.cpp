/* -*- Mode: C++; tab-width: 4; indent-tabs-mode: nil; c-basic-offset: 4 -*-
 *
 * The contents of this file are subject to the Netscape Public
 * License Version 1.1 (the "License"); you may not use this file
 * except in compliance with the License. You may obtain a copy of
 * the License at http://www.mozilla.org/NPL/
 *
 * Software distributed under the License is distributed on an "AS
 * IS" basis, WITHOUT WARRANTY OF ANY KIND, either express or
 * implied. See the License for the specific language governing
 * rights and limitations under the License.
 *
 * The Original Code is mozilla.org code.
 *
 * The Initial Developer of the Original Code is Netscape
 * Communications Corporation.  Portions created by Netscape are
 * Copyright (C) 1998 Netscape Communications Corporation. All
 * Rights Reserved.
 *
 * Contributor(s): 
 *   Pierre Phaneuf <pp@ludusdesign.com>
 */

#include "nsIModule.h"
#include "nsIGenericFactory.h"
#include "nsJVMManager.h"

/*
 * Note:  In revision 1.17 of this file (and earlier) there was a
 * commented out implementation of nsCJVMManagerFactory, a hand-crafted
 * implementation of nsIFactory.
 */

// The list of components we register
static nsModuleComponentInfo components[] = 
{
    { "JVM Manager Service", 
      NS_JVMMANAGER_CID,  
      "@mozilla.org/oji/jvm-mgr;1", 
      nsJVMManager::Create
    },
};

NS_IMPL_NSGETMODULE(nsCJVMManagerModule, components);

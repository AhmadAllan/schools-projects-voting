import { Component } from '@angular/core';
@Component({ standalone:true, template:`<main class="admin"><h1>لوحة الإدارة</h1><nav><a href="#sections">الأقسام</a><a href="#schools">المدارس</a><a href="#projects">المشاريع</a><a href="#settings">الإعدادات</a><a href="#voters">الناخبون</a><a href="#results">النتائج</a></nav></main>`, styles:[`.admin{max-width:1100px;margin:auto;padding:1rem}.admin nav{display:flex;gap:.75rem;flex-wrap:wrap}.admin nav a{padding:.8rem 1rem;border:1px solid #91aaa2}`] })
export class AdminPlaceholderComponent {}
